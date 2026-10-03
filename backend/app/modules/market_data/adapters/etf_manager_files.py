"""What a UCITS ETF holds, from the list its manager publishes.

No regulator publishes a UCITS fund's holdings, so the manager's own product
page is the only source. Each page loads its holdings table from an API of its
own, made for that page and not documented: nothing promises its shape. So a
reader fails rather than guesses — a column it cannot find, a date it cannot
read, or weights that do not add up to the whole fund stop the list — because
a holdings list read wrong looks exactly like one read right.

Every line is kept, cash and derivatives included, as N-PORT keeps them; a
line whose weight the manager leaves blank is kept without one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.domain.etf_registry import is_isin

DWS = 'dws'
ISHARES = 'ishares'
VANGUARD = 'vanguard'

#: How far the weights may sum from the whole fund, as a ratio of it.
#: Rounding of a thousand lines stays inside it; a list cut short does not.
WEIGHT_SUM_TOLERANCE = Decimal('0.05')

#: ISO 3166 alpha-2 by the English name DWS and iShares write, with the
#: spellings each uses. A name not here is left out of the line rather than
#: guessed at, and listed in the run (`ManagerHoldingsFile.unread_countries`)
#: so the table can grow.
COUNTRY_CODES: dict[str, str] = {
    'Argentina': 'AR',
    'Australia': 'AU',
    'Austria': 'AT',
    'Bahrain': 'BH',
    'Bangladesh': 'BD',
    'Belgium': 'BE',
    'Bermuda': 'BM',
    'Brazil': 'BR',
    'Bulgaria': 'BG',
    'Canada': 'CA',
    'Cayman Islands': 'KY',
    'Chile': 'CL',
    'China': 'CN',
    'Colombia': 'CO',
    'Croatia': 'HR',
    'Cyprus': 'CY',
    'Czech Republic': 'CZ',
    'Czechia': 'CZ',
    'Denmark': 'DK',
    'Egypt': 'EG',
    'Estonia': 'EE',
    'Finland': 'FI',
    'France': 'FR',
    'Germany': 'DE',
    'Gibraltar': 'GI',
    'Greece': 'GR',
    'Guernsey': 'GG',
    'Hong Kong': 'HK',
    'Hungary': 'HU',
    'Iceland': 'IS',
    'India': 'IN',
    'Indonesia': 'ID',
    'Ireland': 'IE',
    'Isle of Man': 'IM',
    'Israel': 'IL',
    'Italy': 'IT',
    'Japan': 'JP',
    'Jersey': 'JE',
    'Jordan': 'JO',
    'Kazakhstan': 'KZ',
    'Kenya': 'KE',
    'Korea (South)': 'KR',
    'Korea, Republic of': 'KR',
    'South Korea': 'KR',
    'Kuwait': 'KW',
    'Latvia': 'LV',
    'Lithuania': 'LT',
    'Luxembourg': 'LU',
    'Macao': 'MO',
    'Macau': 'MO',
    'Malaysia': 'MY',
    'Malta': 'MT',
    'Mauritius': 'MU',
    'Mexico': 'MX',
    'Monaco': 'MC',
    'Morocco': 'MA',
    'Netherlands': 'NL',
    'New Zealand': 'NZ',
    'Nigeria': 'NG',
    'Norway': 'NO',
    'Oman': 'OM',
    'Pakistan': 'PK',
    'Panama': 'PA',
    'Peru': 'PE',
    'Philippines': 'PH',
    'Poland': 'PL',
    'Portugal': 'PT',
    'Puerto Rico': 'PR',
    'Qatar': 'QA',
    'Romania': 'RO',
    'Russia': 'RU',
    'Russian Federation': 'RU',
    'Saudi Arabia': 'SA',
    'Singapore': 'SG',
    'Slovakia': 'SK',
    'Slovenia': 'SI',
    'South Africa': 'ZA',
    'Spain': 'ES',
    'Sri Lanka': 'LK',
    'Sweden': 'SE',
    'Switzerland': 'CH',
    'Taiwan': 'TW',
    'Thailand': 'TH',
    'Turkey': 'TR',
    'Türkiye': 'TR',
    'Ukraine': 'UA',
    'United Arab Emirates': 'AE',
    'United Kingdom': 'GB',
    'United States': 'US',
    'Uruguay': 'UY',
    'Vietnam': 'VN',
    'Zambia': 'ZM',
}

#: What a manager writes where a line has no country: the dashes of a cash
#: line, or a bloc. Not a name the table lacks.
NO_COUNTRY = {'', '-', '--', 'European Union', 'Other'}


@dataclass
class ManagerHoldingsFile:
    report_date: date
    holdings: list[dict]
    #: Country names the list wrote that `COUNTRY_CODES` does not know.
    unread_countries: set[str] = field(default_factory=set)


def _text(value) -> str | None:
    text = str(value).strip() if value is not None else ''
    return text or None


def _percent(value) -> Decimal | None:
    """A weight written in percent, as a number; None when it is blank."""
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


class _Lines:
    """The lines read so far, and what of them could not be read."""

    def __init__(self, provider: str):
        self.provider = provider
        self.holdings: list[dict] = []
        self.unread_countries: set[str] = set()

    def country_name(self, name) -> str | None:
        text = _text(name) or ''
        if text in NO_COUNTRY:
            return None
        code = COUNTRY_CODES.get(text)
        if code is None:
            self.unread_countries.add(text)
        return code

    def add(  # noqa: PLR0913
        self,
        *,
        name,
        weight: Decimal | None,
        isin=None,
        ticker=None,
        country: str | None = None,
        currency=None,
    ) -> None:
        name_text = _text(name)
        if name_text is None:
            raise IntegrationBadResponse(
                f'{self.provider} holdings list has a line without a name', provider=self.provider
            )
        isin_text = (_text(isin) or '').upper()
        ticker_text = _text(ticker)
        currency_text = (_text(currency) or '').upper()
        self.holdings.append({
            'name': name_text[:300],
            'isin': isin_text if is_isin(isin_text) else None,
            # A dash is how a cash line says it has no ticker.
            'ticker': ticker_text[:30] if ticker_text and ticker_text != '-' else None,
            'country': country if country and len(country) == 2 else None,
            'currency': currency_text if re.fullmatch(r'[A-Z]{3}', currency_text) else None,
            # Every proportion in the domain is a ratio.
            'weight': weight / 100 if weight is not None else None,
        })

    def report(self, report_date: date) -> ManagerHoldingsFile:
        if not self.holdings:
            raise IntegrationBadResponse(
                f'{self.provider} holdings list lists no holdings', provider=self.provider
            )
        weights = [line['weight'] for line in self.holdings if line['weight'] is not None]
        total = sum(weights, Decimal(0))
        if abs(total - 1) > WEIGHT_SUM_TOLERANCE:
            raise IntegrationBadResponse(
                f'{self.provider} holdings weights add up to {total * 100}% '
                f'over {len(weights)} lines, not the whole fund',
                provider=self.provider,
            )
        return ManagerHoldingsFile(
            report_date=report_date,
            holdings=self.holdings,
            unread_countries=self.unread_countries,
        )


def _out_of_shape(provider: str, what: str, payload) -> IntegrationBadResponse:
    return IntegrationBadResponse(
        f'{provider} holdings answer has no {what}; it starts {str(payload)[:300]}',
        provider=provider,
    )


# --- DWS ----------------------------------------------------------------------

#: The labels of the columns read, as the en-GB page writes them.
DWS_COLUMNS = {'isin': 'ISIN', 'name': 'Name', 'weight': '% Weight', 'country': 'Country'}
#: The table's footnote dates it: "Source: DWS 01/10/2026", day first.
_DWS_SOURCE_DATE = re.compile(r'Source:\s*DWS\s+(\d{1,2})/(\d{1,2})/(\d{4})')


def _dws_table(payload) -> tuple[dict, dict[str, str]]:
    """The holdings table, and the key of each column read, by role."""
    tables = payload.get('tables') if isinstance(payload, dict) else None
    for table in tables or []:
        keys = {column.get('value'): column.get('key') for column in table.get('columns') or []}
        if all(label in keys for label in DWS_COLUMNS.values()):
            return table, {role: keys[label] for role, label in DWS_COLUMNS.items()}
    raise _out_of_shape(DWS, f'table with the columns {sorted(DWS_COLUMNS.values())}', payload)


def _dws_date(table: dict) -> date:
    found = {
        (int(year), int(month), int(day))
        for note in table.get('disclaimers') or []
        for day, month, year in _DWS_SOURCE_DATE.findall(str(note.get('text') or ''))
    }
    if len(found) != 1:
        raise IntegrationBadResponse(
            f'DWS holdings table states {len(found)} "Source: DWS" dates, not one: {sorted(found)}',
            provider=DWS,
        )
    year, month, day = found.pop()
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise IntegrationBadResponse(
            f'DWS holdings date {day}/{month}/{year} is not a date', provider=DWS
        ) from exc


def read_dws_holdings(payload: dict) -> ManagerHoldingsFile:
    """The holdings table of an Xtrackers product page.

    Each cell is `{"value": ..., "sortValue": ...}`; the weight is read from
    the sort value, which is the unrounded percentage the label rounds.
    """
    table, keys = _dws_table(payload)
    report_date = _dws_date(table)
    lines = _Lines(DWS)
    for row in table.get('values') or []:

        def cell(role, field='value', row=row):
            return (row.get(keys[role]) or {}).get(field)

        lines.add(
            name=cell('name'),
            isin=cell('isin'),
            country=lines.country_name(cell('country')),
            weight=_percent(cell('weight', 'sortValue')),
        )
    return lines.report(report_date)


# --- iShares ------------------------------------------------------------------

#: The columns read, as the API names them; the first two are required.
ISHARES_REQUIRED = ('issueName', 'holdingPercent')
ISHARES_OPTIONAL = ('isin', 'ticker', 'countryOfRisk', 'marketCurrencyCode')


def read_ishares_holdings(payload: dict) -> ManagerHoldingsFile:
    """The holdings component of an iShares product page.

    It comes by column — each data point a list with one value per line — and
    dated by `asOfDate`, written `20261001`.
    """
    try:
        points = payload['componentsByNameMap']['holdings']['containersByNameMap']['all'][
            'dataPointsByNameMap'
        ]
    except (KeyError, TypeError) as exc:
        raise _out_of_shape(ISHARES, 'holdings component', payload) from exc
    missing = [name for name in (*ISHARES_REQUIRED, 'asOfDate') if name not in points]
    if missing:
        raise _out_of_shape(ISHARES, f'{missing} data points', sorted(points))

    raw_date = str((points['asOfDate'] or {}).get('value') or '')
    try:
        report_date = datetime.strptime(raw_date, '%Y%m%d').date()
    except ValueError as exc:
        raise IntegrationBadResponse(
            f'iShares holdings date {raw_date!r} is not a date', provider=ISHARES
        ) from exc

    columns = {
        name: (points[name] or {}).get('value') or []
        for name in (*ISHARES_REQUIRED, *ISHARES_OPTIONAL)
        if name in points
    }
    count = len(columns['issueName'])
    uneven = {name: len(values) for name, values in columns.items() if len(values) != count}
    if uneven:
        raise IntegrationBadResponse(
            f'iShares holdings columns are uneven: {count} names, {uneven}', provider=ISHARES
        )

    lines = _Lines(ISHARES)
    for index in range(count):

        def cell(name, index=index):
            values = columns.get(name)
            return values[index] if values is not None else None

        lines.add(
            name=cell('issueName'),
            isin=cell('isin'),
            ticker=cell('ticker'),
            country=lines.country_name(cell('countryOfRisk')),
            currency=cell('marketCurrencyCode'),
            weight=_percent(cell('holdingPercent')),
        )
    return lines.report(report_date)


# --- Vanguard -----------------------------------------------------------------


def read_vanguard_holdings(payload: dict) -> ManagerHoldingsFile:
    """Every page of a Vanguard fund's holdings, joined by the client.

    Each line carries its own `effectiveDate`; they must agree, and the lines
    must be as many as the first page counted, or a page went missing.
    """
    items = payload.get('items') if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise _out_of_shape(VANGUARD, 'items', payload)
    total = payload.get('totalHoldings')
    if total != len(items):
        raise IntegrationBadResponse(
            f'Vanguard counted {total} holdings and sent {len(items)}', provider=VANGUARD
        )
    dates = {item.get('effectiveDate') for item in items}
    if len(dates) != 1:
        raise IntegrationBadResponse(
            f'Vanguard holdings carry {len(dates)} dates, not one: {sorted(map(str, dates))[:5]}',
            provider=VANGUARD,
        )
    raw_date = str(dates.pop())
    try:
        report_date = date.fromisoformat(raw_date)
    except ValueError as exc:
        raise IntegrationBadResponse(
            f'Vanguard holdings date {raw_date!r} is not a date', provider=VANGUARD
        ) from exc

    lines = _Lines(VANGUARD)
    for item in items:
        lines.add(
            name=item.get('securityLongDescription'),
            isin=item.get('isin'),
            ticker=item.get('ticker'),
            # Already a code: Bloomberg's, which is ISO 3166 alpha-2.
            country=(_text(item.get('bloombergIsoCountry')) or '').upper() or None,
            weight=_percent(item.get('marketValuePercentage')),
        )
    return lines.report(report_date)
