"""The published profile of a real-estate fund.

Nothing here is persisted. A fund republishes these numbers once a month with
its management report, the application has no use for their history yet, and
holding a stale copy would be worse than asking the provider, so the profile is
read on demand and cached briefly.

Every field is optional on purpose. A provider that has never covered a fund,
or that stops publishing one indicator, must cost the page that one value --
not the chart, not the rest of the card.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any


@dataclass(frozen=True)
class FIIDividend:
    """One distribution per share, on the date it reached the holder."""

    date: date
    value_per_share: float

    def to_dict(self) -> dict[str, Any]:
        return {'date': self.date.isoformat(), 'value_per_share': self.value_per_share}


@dataclass(frozen=True, kw_only=True)
class FIIIndicators:
    """What the fund reports about itself, as of its last published report.

    ``as_of_date`` belongs with the rest: an equity or a vacancy rate carries a
    reference date, and a reader who cannot see it has no way to tell last
    month's report from one that stopped being updated a year ago.

    The yields and the return are percentages as the provider publishes them,
    so 8.5 means 8.5% -- they are carried through unscaled and formatted as
    percentages by their readers.
    """

    as_of_date: date | None = None
    segment: str | None = None
    segment_type: str | None = None
    manager: str | None = None
    administrator: str | None = None
    price: float | None = None
    #: Patrimônio líquido por cota.
    book_value_per_share: float | None = None
    #: P/VP.
    price_to_book: float | None = None
    dividend_yield_12m: float | None = None
    dividend_yield_1m: float | None = None
    monthly_return: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    shares_outstanding: float | None = None
    shareholders: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'as_of_date': self.as_of_date.isoformat() if self.as_of_date else None,
            'segment': self.segment,
            'segment_type': self.segment_type,
            'manager': self.manager,
            'administrator': self.administrator,
            'price': self.price,
            'book_value_per_share': self.book_value_per_share,
            'price_to_book': self.price_to_book,
            'dividend_yield_12m': self.dividend_yield_12m,
            'dividend_yield_1m': self.dividend_yield_1m,
            'monthly_return': self.monthly_return,
            'equity': self.equity,
            'total_assets': self.total_assets,
            'shares_outstanding': self.shares_outstanding,
            'shareholders': self.shareholders,
        }


@dataclass(frozen=True, kw_only=True)
class FIIProfile:
    """A fund's indicators together with the distributions it has paid.

    The two halves come from different provider routes and are served together
    because they answer the same question. Either may be absent: one route
    failing leaves the other's data on the page rather than emptying it.
    """

    ticker: str
    indicators: FIIIndicators | None = None
    dividends: list[FIIDividend] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            'ticker': self.ticker,
            'indicators': self.indicators.to_dict() if self.indicators else None,
            'dividends': [dividend.to_dict() for dividend in self.dividends],
        }
