"""Spreadsheets shaped like a manager's holdings export.

Built here, not captured: the DWS file could not be downloaded from where this
reader was written. The layout — a title block with the date, the header,
the lines, then footnotes — is what the reader is built to find; when a real
file disagrees, the reader fails and this fixture is replaced by a slice of
that file.
"""

import io
from datetime import datetime

from openpyxl import Workbook

EXUS_ISIN = 'IE0006WW1TQ4'

HEADER = ('Name', 'ISIN', 'Country', 'Currency', 'Exchange', 'Type of Security', 'Weighting')

LINES = (
    ('ASML HOLDING NV', 'NL0010273215', 'NL', 'EUR', 'Euronext Amsterdam', 'Equity', 2.5),
    ('NESTLE SA', 'CH0038863350', 'Switzerland', 'CHF', 'SIX Swiss Exchange', 'Equity', 1.5),
    ('TOYOTA MOTOR CORP', 'JP3633400001', 'JP', 'JPY', 'Tokyo', 'Equity', 96.0),
)


def constituents_xlsx(
    *,
    title: tuple = ('Xtrackers MSCI World ex USA UCITS ETF 1C', 'As of 30/09/2026'),
    header: tuple = HEADER,
    lines: tuple = LINES,
    footnotes: tuple = ('Source: DWS', 'Past performance is no guide to future returns.'),
) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for cell in title:
        sheet.append([cell])
    sheet.append([])
    sheet.append(list(header))
    for line in lines:
        sheet.append(list(line))
    sheet.append([])
    for note in footnotes:
        sheet.append([note])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def dated(value: datetime) -> tuple:
    """A title block whose date is a date cell rather than text."""
    return ('Xtrackers MSCI World ex USA UCITS ETF 1C', 'Date', value)
