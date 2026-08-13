"""The published profile of a real-estate fund.

Nothing here is persisted. A fund republishes these numbers once a month with
its management report, the application has no use for their history yet, and
holding a stale copy would be worse than asking the provider, so the profile is
read on demand and cached briefly.

Every indicator is optional, and an absent one is ``None`` rather than zero:
a fund whose price-to-NAV the provider does not publish has an unknown P/VP,
which is a different statement from a P/VP of zero.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

#: What the provider labels an ordinary monthly distribution. Funds also
#: amortize capital, which arrives through the same route under its own label
#: and is not income -- the two are kept apart rather than added together.
INCOME_EVENT_LABEL = 'RENDIMENTO'


@dataclass(frozen=True, kw_only=True)
class FIIDividend:
    """One payment per share made by a fund.

    ``event_type`` is the provider's own label, carried through because it is
    the only thing separating income from an amortization of capital. Readers
    that mean income filter on it; nothing here decides that for them.
    """

    payment_date: date
    value_per_share: float
    #: The date that settled who had the right to the payment.
    ex_date: date | None = None
    event_type: str | None = None

    @property
    def is_income(self) -> bool:
        """Whether this is a distribution of income rather than of capital.

        A fund whose events carry no label at all is read as paying income:
        that is what these routes overwhelmingly return, and dropping every
        unlabelled payment would empty the history of the funds whose labels
        the provider simply does not fill in.
        """
        return self.event_type is None or self.event_type.upper() == INCOME_EVENT_LABEL

    def to_dict(self) -> dict[str, Any]:
        return {
            'payment_date': self.payment_date.isoformat(),
            'ex_date': self.ex_date.isoformat() if self.ex_date else None,
            'value_per_share': self.value_per_share,
            'event_type': self.event_type,
        }


@dataclass(frozen=True, kw_only=True)
class FIIIndicators:
    """What the fund reports about itself, as of its last published report.

    ``as_of_date`` belongs with the rest: an equity or a yield carries a
    reference date, and a reader who cannot see it has no way to tell last
    month's report from one that stopped being updated a year ago.

    ``dividend_yield_12m``, ``dividend_yield_1m`` and ``monthly_return`` are
    ratios, not percentages: 0.12381 is 12.381%. ``price_to_nav`` is a multiple
    around 1 and is neither -- 1.018 means the share trades 1.8% above the
    fund's own valuation. Presentation decides how each is written; nothing is
    scaled here.
    """

    as_of_date: date | None = None
    #: The fund's strategy, in the provider's words: "tijolo", "papel".
    segment_type: str | None = None
    #: Where it invests, one level down: "Shoppings", "Logística".
    segment: str | None = None
    price: float | None = None
    #: Valor patrimonial por cota.
    nav_per_share: float | None = None
    #: P/VP, as published. Never recomputed from price and NAV.
    price_to_nav: float | None = None
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
            'segment_type': self.segment_type,
            'segment': self.segment,
            'price': self.price,
            'nav_per_share': self.nav_per_share,
            'price_to_nav': self.price_to_nav,
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
    """A fund's indicators together with the payments it has made.

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
