"""Real-estate fund profile schemas."""

from datetime import date

from pydantic import BaseModel


class FIIDividendResponse(BaseModel):
    date: date
    value_per_share: float


class FIIIndicatorsResponse(BaseModel):
    """The fund's own numbers, as of the report they came from.

    Yields and the monthly return are percentages the way the provider
    publishes them: 8.5 means 8.5% a year, not 850%.
    """

    as_of_date: date | None = None
    segment: str | None = None
    segment_type: str | None = None
    manager: str | None = None
    administrator: str | None = None
    price: float | None = None
    book_value_per_share: float | None = None
    price_to_book: float | None = None
    dividend_yield_12m: float | None = None
    dividend_yield_1m: float | None = None
    monthly_return: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    shares_outstanding: float | None = None
    shareholders: int | None = None


class FIIProfileResponse(BaseModel):
    ticker: str
    indicators: FIIIndicatorsResponse | None = None
    dividends: list[FIIDividendResponse] = []
