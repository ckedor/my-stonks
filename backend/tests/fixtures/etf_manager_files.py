"""Files shaped like a manager's holdings export.

Built here, not captured: neither the DWS nor the iShares file could be
downloaded from where these readers were written. The layouts — a block with
the date, the header, the lines, then footnotes — are what the readers are
built to find; when a real file disagrees, the reader fails and its fixture is
replaced by a slice of that file.
"""

import csv
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


CSPX_ISIN = 'IE00B5BMR087'

ISHARES_HEADER = (
    'Ticker',
    'Name',
    'Sector',
    'Asset Class',
    'Market Value',
    'Weight (%)',
    'Notional Value',
    'Nominal',
    'Price',
    'Location',
    'Exchange',
    'Market Currency',
)

ISHARES_LINES = (
    (
        'NVDA',
        'NVIDIA CORP',
        'Information Technology',
        'Equity',
        '8,100,000,000.00',
        '7.80',
        '8,100,000,000.00',
        '45,000,000',
        '180.00',
        'United States',
        'NASDAQ',
        'USD',
    ),
    (
        'AAPL',
        'APPLE INC',
        'Information Technology',
        'Equity',
        '6,900,000,000.00',
        '6.60',
        '6,900,000,000.00',
        '27,000,000',
        '255.00',
        'United States',
        'NASDAQ',
        'USD',
    ),
    (
        'MSFT',
        'MICROSOFT CORP',
        'Information Technology',
        'Equity',
        '89,000,000,000.00',
        '85.40',
        '89,000,000,000.00',
        '172,000,000',
        '517.00',
        'United States',
        'NASDAQ',
        'USD',
    ),
    (
        '-',
        'USD CASH',
        'Cash and/or Derivatives',
        'Cash',
        '200,000,000.00',
        '0.20',
        '200,000,000.00',
        '200,000,000',
        '100.00',
        'United States',
        '-',
        'USD',
    ),
)

ISHARES_FACTS = (
    ('iShares Core S&P 500 UCITS ETF',),
    ('Fund Holdings as of', '30/Sep/2026'),
    ('Inception Date', '19/May/2010'),
    ('Shares Outstanding', '170,000,000.00'),
)


def holdings_csv(
    *,
    facts: tuple = ISHARES_FACTS,
    header: tuple = ISHARES_HEADER,
    lines: tuple = ISHARES_LINES,
) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_NONNUMERIC)
    for row in facts:
        writer.writerow(row)
    writer.writerow([' '])
    writer.writerow(header)
    for line in lines:
        writer.writerow(line)
    writer.writerow([' '])
    writer.writerow(['The content contained herein is owned or licensed by BlackRock.'])
    return ('\ufeff' + buffer.getvalue()).encode('utf-8')
