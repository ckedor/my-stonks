"""Asset quote schemas."""

from datetime import date

from pydantic import BaseModel


class QuoteResponse(BaseModel):
    date: date
    close: float | None
    open: float | None = None
    high: float | None = None
    low: float | None = None
    adjusted_close: float | None = None
    volume: float | None = None
    currency_id: int | None = None
    source: str | None = None


class PersistedQuotesResponse(BaseModel):
    asset_id: int
    ticker: str
    asset_type_id: int
    quotes: list[QuoteResponse]


class OnDemandQuotesResponse(BaseModel):
    ticker: str
    asset_type_id: int
    currency: str | None = None
    logo_url: str | None = None
    quotes: list[QuoteResponse]


class HistoricalCagrResponse(BaseModel):
    """Annualized growth over the served history, and the window it covers."""

    value: float
    start_date: date
    end_date: date


class AssetQuoteHistoryResponse(BaseModel):
    ticker: str
    asset_type_id: int
    currency: str | None = None
    logo_url: str | None = None
    #: Where the quotes came from: 'database' or 'provider'.
    source: str
    quotes: list[QuoteResponse]
    #: Absent when the history is too short to annualize honestly.
    cagr: HistoricalCagrResponse | None = None
