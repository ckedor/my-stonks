"""Market-data series schemas."""

from datetime import date

from pydantic import BaseModel, ConfigDict


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
