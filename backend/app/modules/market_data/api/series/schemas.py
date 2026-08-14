"""Market-data series schemas."""

from datetime import date

from pydantic import BaseModel, ConfigDict, RootModel

from app.modules.market_data.api.currency.schemas import Currency


class MarketDataSeriesOption(BaseModel):
    """Minimal identity used to pick a series in a selector."""

    id: int
    short_name: str
    name: str
    symbol: str

    model_config = ConfigDict(from_attributes=True)


class MarketDataSeriesHistoryPoint(BaseModel):
    date: date
    close: float | None = None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    source: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MarketDataSeriesResponse(BaseModel):
    """A registered series with everything that identifies and types it."""

    id: int
    short_name: str
    name: str
    symbol: str
    currency_id: int | None = None
    series_type: str
    value_type: str
    frequency: str
    currency: Currency | None = None

    model_config = ConfigDict(from_attributes=True)


class MarketDataSeriesPoint(BaseModel):
    date: date
    value: float

    model_config = ConfigDict(from_attributes=True)


class MarketDataSeriesTimeSeries(RootModel[dict[str, list[MarketDataSeriesPoint]]]):
    """Each series by its short name, mapped to its observations."""
