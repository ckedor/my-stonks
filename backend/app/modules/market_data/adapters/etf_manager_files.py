"""What a UCITS ETF holds, from the file its manager publishes.

No regulator publishes a UCITS fund's holdings, so the manager's own export is
the only source. It is a page made for people, not a filing: nothing promises
its layout. So the reader fails rather than guesses — a header it cannot
find, a date it cannot read, or weights that do not add up to the whole fund
stop the file — because a holdings list read wrong looks exactly like one
read right.

Synchronous and file-bound: run it off the event loop.
"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.domain.etf_registry import is_isin

PROVIDER = 'dws'

#: Rows searched for the header: the file opens with a title block.
HEADER_SEARCH_ROWS = 30

#: How far the weights may sum from the whole fund. Rounding of a thousand
#: lines and a cash line left out stay inside it; a file cut short does not.
WEIGHT_SUM_TOLERANCE = Decimal('0.05')

_ISO_DATE = re.compile(r'\b(\d{4})-(\d{2})-(\d{2})\b')
#: The UK export writes dates day first.
_DAY_FIRST_DATE = re.compile(r'\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b')
_NAMED_MONTH_DATE = re.compile(r'\b(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4})\b')


@dataclass
class ManagerHoldingsFile:
    report_date: date
    holdings: list[dict]


def _label(value) -> str:
    """A header cell, compared without case, spacing or punctuation."""
    return re.sub(r'[^a-z]', '', str(value or '').lower())


def _text(value) -> str | None:
    text = str(value).strip() if value is not None else ''
    return text or None


def _number(value) -> tuple[Decimal, bool] | None:
    """The cell's number, and whether it was written as a percentage."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int | float | Decimal):
        return Decimal(str(value)), False
    text = str(value).strip().replace('\u00a0', '').replace(' ', '')
    percent = text.endswith('%')
    text = text.rstrip('%')
    # A lone comma is the decimal mark; next to a point, it groups thousands.
    text = text.replace(',', '.') if ',' in text and '.' not in text else text.replace(',', '')
    try:
        return Decimal(text), percent
    except InvalidOperation:
        return None


def _dates_in(value) -> set[date]:
    if isinstance(value, datetime):
        return {value.date()}
    if isinstance(value, date):
        return {value}
    if not isinstance(value, str):
        return set()
    found: set[date] = set()
    for year, month, day in _ISO_DATE.findall(value):
        found.add(_safe_date(int(year), int(month), int(day)))
    for day, month, year in _DAY_FIRST_DATE.findall(value):
        found.add(_safe_date(int(year), int(month), int(day)))
    for day, month, year in _NAMED_MONTH_DATE.findall(value):
        for pattern in ('%d %b %Y', '%d %B %Y'):
            try:
                found.add(datetime.strptime(f'{day} {month} {year}', pattern).date())
                break
            except ValueError:
                continue
    found.discard(date.min)
    return found


def _safe_date(year: int, month: int, day: int) -> date:
    try:
        return date(year, month, day)
    except ValueError:
        return date.min


def _header(rows: list[tuple]) -> tuple[int, dict[str, int]] | None:
    """The header row's index and the columns read, by role."""
    for index, row in enumerate(rows[:HEADER_SEARCH_ROWS]):
        labels = [_label(cell) for cell in row]
        columns: dict[str, int] = {}
        for position, label in enumerate(labels):
            if label == 'name':
                columns.setdefault('name', position)
            elif label == 'isin':
                columns.setdefault('isin', position)
            elif label.startswith('weight'):
                columns.setdefault('weight', position)
            elif label == 'country':
                columns.setdefault('country', position)
            elif label == 'currency':
                columns.setdefault('currency', position)
        if {'name', 'isin', 'weight'} <= columns.keys():
            return index, columns
    return None


def _cell(row: tuple, position: int | None):
    if position is None or position >= len(row):
        return None
    return row[position]


def _weight_scale(weights: list[Decimal], *, percent_signs: bool) -> Decimal:
    """100 when the weights are percentages, 1 when they are ratios.

    Either way they must add up to the whole fund: a file cut short, or a
    column that is not the weight, does not.
    """
    total = sum(weights, Decimal(0))
    if percent_signs or abs(total / 100 - 1) <= WEIGHT_SUM_TOLERANCE:
        scale = Decimal(100)
    elif abs(total - 1) <= WEIGHT_SUM_TOLERANCE:
        scale = Decimal(1)
    else:
        raise IntegrationBadResponse(
            f'DWS constituents weights add up to {total} over {len(weights)} lines, '
            'neither the whole fund in percent nor as a ratio',
            provider=PROVIDER,
        )
    if abs(total / scale - 1) > WEIGHT_SUM_TOLERANCE:
        raise IntegrationBadResponse(
            f'DWS constituents weights add up to {total}% over {len(weights)} lines',
            provider=PROVIDER,
        )
    return scale


def _holding(row: tuple, columns: dict[str, int], weight: Decimal) -> dict:
    isin = (_text(_cell(row, columns['isin'])) or '').upper()
    country = (_text(_cell(row, columns.get('country'))) or '').upper()
    currency = (_text(_cell(row, columns.get('currency'))) or '').upper()
    return {
        'name': (_text(_cell(row, columns['name'])) or '')[:300],
        'isin': isin if is_isin(isin) else None,
        # The table keeps a code; a country written out is left out rather
        # than translated by guess.
        'country': country if len(country) == 2 and country.isalpha() else None,
        'currency': currency if len(currency) == 3 and currency.isalpha() else None,
        'weight': weight,
    }


def read_dws_constituents(content: bytes) -> ManagerHoldingsFile:
    """DWS's constituents spreadsheet: the date it describes and every line.

    The weight is returned as a ratio, as every proportion in the domain is,
    whether the file writes 5.12, "5.12%" or 0.0512: the file says which by
    its percent sign or, without one, by what the weights add up to.
    """
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except (InvalidFileException, zipfile.BadZipFile, KeyError, OSError, ValueError) as exc:
        raise IntegrationBadResponse(
            f'DWS constituents file is not an xlsx workbook (starts with {content[:16]!r})',
            provider=PROVIDER,
        ) from exc
    try:
        sheets = [list(sheet.iter_rows(values_only=True)) for sheet in workbook.worksheets]
    finally:
        workbook.close()

    for rows in sheets:
        found = _header(rows)
        if found is not None:
            break
    else:
        seen = (
            [[cell for cell in row if cell is not None] for row in sheets[0][:10]] if sheets else []
        )
        raise IntegrationBadResponse(
            f'DWS constituents file has no Name/ISIN/Weighting header; first rows: {seen}'[:500],
            provider=PROVIDER,
        )
    header_index, columns = found

    dates = {day for row in rows[:header_index] for cell in row for day in _dates_in(cell)}
    if len(dates) != 1:
        raise IntegrationBadResponse(
            f'DWS constituents file states {len(dates)} dates above its header, not one: '
            f'{sorted(dates)}',
            provider=PROVIDER,
        )
    report_date = dates.pop()

    lines: list[tuple[tuple, Decimal]] = []
    percent_signs = False
    for row in rows[header_index + 1 :]:
        name = _text(_cell(row, columns['name']))
        weight = _number(_cell(row, columns['weight']))
        # The table ends at the first line without a name or a weight: what
        # follows is the footnotes.
        if name is None or weight is None:
            break
        lines.append((row, weight[0]))
        percent_signs = percent_signs or weight[1]
    if not lines:
        raise IntegrationBadResponse('DWS constituents file lists no holdings', provider=PROVIDER)

    scale = _weight_scale([weight for _, weight in lines], percent_signs=percent_signs)
    holdings = [_holding(row, columns, weight / scale) for row, weight in lines]
    return ManagerHoldingsFile(report_date=report_date, holdings=holdings)
