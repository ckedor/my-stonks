from enum import IntEnum


class ASSET_CLASS(IntEnum):
    FIXED_INCOME = 1


class ASSET_FIXED_INCOME_TYPE(IntEnum):
    FIXED_RATE = 1
    INDEX_PLUS = 2
    PERC_INDEX = 3


class ASSET_TYPE(IntEnum):
    ETF = 1
    FII = 2
    TREASURY = 3
    STOCK = 4
    BDR = 5
    PREV = 6
    FI = 7
    CDB = 8
    DEB = 9
    CRI = 10
    CRA = 11
    REIT = 12
    CRIPTO = 13
    LCA = 14


#: Asset types a market-data provider can return quotes for. Callers selecting
#: assets to ingest filter by these.
SUPPORTED_QUOTE_ASSET_TYPES = (
    ASSET_TYPE.STOCK,
    ASSET_TYPE.BDR,
    ASSET_TYPE.ETF,
    ASSET_TYPE.REIT,
    ASSET_TYPE.FII,
    ASSET_TYPE.CRIPTO,
)


class CURRENCY(IntEnum):
    BRL = 1
    USD = 2


CURRENCY_MAP = {'BRL': CURRENCY.BRL, 'USD': CURRENCY.USD}


class FII_SEGMENT(IntEnum):
    SHOPPING = 1
    CORPORATE = 2
    LOGISTICS = 3
    HOSPITAL = 4
    EDUCATIONAL = 5
    BANK_AGENCIES = 6
    HYBRID = 7
    RECEIVABLES = 8
    FOF = 9
    DEVELOPMENT = 10
    OTHERS = 11
    HOTELS = 12
    RESIDENTIAL = 13
    INCORPORATIONS = 14
    RETAIL = 15


class SERIES(IntEnum):
    """The registered market-data series, by id.

    Not `INDEX`: only IFIX, S&P500, IBOVESPA, NASDAQ and the MSCI indexes are
    of the `market_index` type. CDI is an interest rate, IPCA an inflation rate
    and gold a commodity price, and calling any of them an index says something
    the data does not.

    No USDBRL member: the exchange rate is not a market-data series, it has
    its own table. See app.modules.market_data.domain.usd_brl.
    """

    IPCA = 2
    CDI = 3
    IFIX = 4
    SP500 = 5
    IBOVESPA = 6
    NASDAQ = 7
    MSCI_WORLD = 8
    MSCI_ACWI = 9
    MSCI_EM = 10
    MSCI_USA = 11
    MSCI_ACWI_EX_USA = 12
    GOLD = 13


#: The MSCI indexes, all stored as net total return in USD: dividends matter
#: over decades, and a price-only index would lose to the CDI it is compared
#: with by the yield alone. Their symbol is MSCI's own index code.
MSCI_SERIES = frozenset({
    SERIES.MSCI_WORLD,
    SERIES.MSCI_ACWI,
    SERIES.MSCI_EM,
    SERIES.MSCI_USA,
    SERIES.MSCI_ACWI_EX_USA,
})
