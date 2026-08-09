from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum


class MarketDataSeriesType(StrEnum):
    MARKET_INDEX = 'market_index'
    INTEREST_RATE = 'interest_rate'
    INFLATION_RATE = 'inflation_rate'


class MarketDataSeriesValueType(StrEnum):
    LEVEL = 'level'
    PERCENTAGE = 'percentage'


class MarketDataSeriesFrequency(StrEnum):
    DAILY = 'daily'
    MONTHLY = 'monthly'


@dataclass(eq=False, kw_only=True)
class MarketDataSeries:
    symbol: str
    short_name: str
    name: str
    series_type: MarketDataSeriesType | str
    value_type: MarketDataSeriesValueType | str
    frequency: MarketDataSeriesFrequency | str
    currency_id: int | None = None
    id: int | None = None
    currency: object | None = field(default=None, init=False, repr=False)


@dataclass(eq=False, kw_only=True)
class MarketDataSeriesHistory:
    series_id: int
    date: date
    id: int | None = None
    open: Decimal | None = None
    close: Decimal | None = None
    high: Decimal | None = None
    low: Decimal | None = None
    source: str = 'unknown'
    series: MarketDataSeries | None = field(default=None, init=False, repr=False)
