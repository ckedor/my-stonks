"""Real-estate fund profile schemas."""

from datetime import date

from pydantic import BaseModel


class FIIDividendResponse(BaseModel):
    """One payment per share, as published.

    ``event_type`` is what the fund called it — an ordinary distribution or an
    amortization of capital. It is carried so that a reader meaning income can
    tell the two apart instead of adding them up.
    """

    payment_date: date
    ex_date: date | None = None
    value_per_share: float
    event_type: str | None = None


class FIIIndicatorsResponse(BaseModel):
    """The fund's own numbers, as of the report they came from.

    The yields and the monthly return are ratios: 0.12381 is 12.381%.
    ``price_to_nav`` is the published P/VP, a multiple around 1. None of them
    is scaled here; the client decides how each is written.
    """

    as_of_date: date | None = None
    segment_type: str | None = None
    segment: str | None = None
    price: float | None = None
    nav_per_share: float | None = None
    price_to_nav: float | None = None
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
