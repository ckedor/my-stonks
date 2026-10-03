"""Answers shaped like each manager's holdings API.

Sliced from the real answers of 2026-10-02 — EXUS from DWS, CSPX from iShares,
VWRA from Vanguard — keeping their shape, labels and spellings, a few lines
each. Only the last line's weight is changed, to make the slice add up to the
whole fund the way the full list does.
"""

EXUS_ISIN = 'IE0006WW1TQ4'
CSPX_ISIN = 'IE00B5BMR087'
VWRA_ISIN = 'IE00BK5BQT80'

# --- DWS ----------------------------------------------------------------------

DWS_COLUMNS = [
    {'key': 'header', 'value': 'ISIN', 'alignment': 'left', 'isVisibleOnHeader': True},
    {'key': 'column_0', 'value': 'Name', 'alignment': 'left', 'isVisibleOnHeader': True},
    {'key': 'column_1', 'value': '% Weight', 'alignment': 'right', 'isVisibleOnHeader': True},
    {'key': 'column_2', 'value': 'Market value', 'alignment': 'right', 'isVisibleOnHeader': True},
    {'key': 'column_3', 'value': 'Country', 'alignment': 'left', 'isVisibleOnHeader': True},
    {'key': 'column_4', 'value': 'Industry', 'alignment': 'left', 'isVisibleOnHeader': True},
    {'key': 'column_5', 'value': 'Asset class', 'alignment': 'left', 'isVisibleOnHeader': True},
]

#: (ISIN, name, weight in percent, country, asset class)
DWS_LINES = (
    ('NL0010273215', 'ASML HOLDING', 2.8835911700, 'Netherlands', 'Equities'),
    ('GB0005405286', 'HSBC HOLDINGS PLC', 1.3473520500, 'United Kingdom', 'Equities'),
    ('_CURRENCYSEK', 'SWEDISH KRONA', 0.00069006, 'Sweden', 'Cash'),
    ('___ADI2TZ5Y1', 'S+P/TSX 60 IX FUT DEC26', 0.0, 'Canada', 'Future'),
    ('JP3633400001', 'TOYOTA MOTOR CORP', 95.76836672, 'Japan', 'Equities'),
)


def dws_row(isin, name, weight, country, asset_class) -> dict:
    return {
        'header': {'value': isin, 'type': 'text'},
        'column_0': {'value': name, 'type': 'text'},
        'column_1': {'value': f'{weight:.3f}%', 'sortValue': weight, 'type': 'text'},
        'column_2': {'value': '0.00 M USD', 'sortValue': 0.0, 'type': 'text'},
        'column_3': {'value': country, 'type': 'text'},
        'column_4': {'value': 'Unknown', 'type': 'text'},
        'column_5': {'value': asset_class, 'type': 'text'},
    }


def dws_holdings(
    *,
    columns: list = DWS_COLUMNS,
    lines: tuple = DWS_LINES,
    disclaimers: tuple = ('<p>Source: DWS 01/10/2026</p>',),
) -> dict:
    return {
        'tables': [
            {
                'columns': columns,
                'values': [dws_row(*line) for line in lines],
                'disclaimers': [
                    {'text': text, 'disableDefaultWrapping': True} for text in disclaimers
                ],
                'headlineText': 'Securities held in Securities Holdings',
            }
        ],
        'accordionItems': [],
        'asOfDate': '',
    }


# --- iShares ------------------------------------------------------------------

#: (ticker, name, ISIN, location, market currency, weight in percent)
ISHARES_LINES = (
    ('NVDA', 'NVIDIA', 'US67066G1040', 'United States', 'USD', 8.43983),
    ('AAPL', 'APPLE', 'US0378331005', 'United States', 'USD', 7.28312),
    ('USD', 'USD CASH', None, 'United States', 'USD', 0.18441),
    ('ESZ6', 'S&P500 EMINI DEC 26', None, None, 'USD', 0.0),
    ('MSFT', 'MICROSOFT', 'US5949181045', 'United States', 'USD', 84.09264),
)


def ishares_holdings(*, lines: tuple = ISHARES_LINES, as_of: int = 20261001, drop=()) -> dict:
    columns = dict(
        zip(
            (
                'ticker',
                'issueName',
                'isin',
                'countryOfRisk',
                'marketCurrencyCode',
                'holdingPercent',
            ),
            zip(*lines, strict=True),
            strict=True,
        )
    )
    points = {
        'asOfDate': {'name': 'asOfDate', 'formattedValue': '01/Oct/2026', 'value': as_of},
        'assetClass': {'name': 'assetClass', 'value': ['Equity'] * len(lines)},
        **{
            name: {'name': name, 'formattedValue': list(values), 'value': list(values)}
            for name, values in columns.items()
        },
    }
    for name in drop:
        points.pop(name)
    return {
        'componentsByNameMap': {
            'holdings': {
                'containersByNameMap': {'all': {'dataPointsByNameMap': points}},
            }
        },
        'pageScopeData': {'portfolioId': '253743', 'ticker': 'CSPX'},
    }


# --- Vanguard -----------------------------------------------------------------

VANGUARD_ITEMS = (
    {
        'securityLongDescription': 'NVIDIA Corp',
        'isin': 'US67066G1040',
        'ticker': 'NVDA',
        'bloombergIsoCountry': 'US',
        'marketValuePercentage': 4.76598,
        'effectiveDate': '2026-08-31',
    },
    {
        'securityLongDescription': 'Taiwan Semiconductor Manufacturing Co Ltd',
        'isin': 'TW0002330008',
        'ticker': '2330',
        'bloombergIsoCountry': 'TW',
        'marketValuePercentage': 1.22803,
        'effectiveDate': '2026-08-31',
    },
    {
        'securityLongDescription': 'USD/JPY FWD 20260916',
        'isin': None,
        'ticker': 'USD',
        'bloombergIsoCountry': None,
        'marketValuePercentage': 0.05613,
        'effectiveDate': '2026-08-31',
    },
    {
        'securityLongDescription': 'Apple Inc',
        'isin': 'US0378331005',
        'ticker': 'AAPL',
        'bloombergIsoCountry': 'US',
        'marketValuePercentage': 93.94986,
        'effectiveDate': '2026-08-31',
    },
)


def vanguard_holdings(*, items: tuple = VANGUARD_ITEMS, total: int | None = None) -> dict:
    return {
        'totalHoldings': len(items) if total is None else total,
        'items': [dict(item) for item in items],
    }
