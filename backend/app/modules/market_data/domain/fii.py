"""The published profile of a real-estate fund.

Nothing here is persisted. A fund republishes these numbers once a month with
its management report, the application has no use for their history yet, and
holding a stale copy would be worse than asking the provider, so the profile is
read on demand and cached briefly.

The profile is everything the provider publishes about one fund, and it arrives
on three clocks: the indicators and the monthly report are monthly, the payments
follow the fund's own calendar, and the composition of what it holds -- the
buildings, the paper, the shares in other funds -- is filed once a quarter and
lands months late. Each piece carries the date it refers to for that reason: a
vacancy read without its quarter is a number about nothing.

Every indicator is optional, and an absent one is ``None`` rather than zero:
a fund whose price-to-NAV the provider does not publish has an unknown P/VP,
which is a different statement from a P/VP of zero.
"""

from __future__ import annotations

from dataclasses import dataclass, field, fields, is_dataclass
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
class FIIManagement:
    """Who runs the fund and under which mandate.

    Published beside the indicators and kept apart from them: none of it is a
    measurement, and a mandate laid out among the numbers reads as one.
    """

    cnpj: str | None = None
    #: What the fund is chartered to pursue: income, capital gain, or both.
    mandate: str | None = None
    #: Whether the portfolio is actively managed or fixed by the charter.
    management_type: str | None = None
    administrator_name: str | None = None
    administrator_website: str | None = None


@dataclass(frozen=True, kw_only=True)
class FIIMonthlyReport:
    """The report the administrator files with the regulator every month.

    It is where a fund states what its equity is made of, in reais: buildings,
    paper, shares in other funds, receivables and cash. The indicators say how
    much the fund is worth; this says of what.

    ``admin_fee_rate``, ``amortization_rate`` and the patrimonial return are
    ratios, like every other rate here; the monetary fields are absolute reais,
    not per share. Indicators the report repeats -- price, yields, shareholders
    -- are left to :class:`FIIIndicators` rather than restated under a second
    name.
    """

    reference_date: date | None = None
    admin_fee_rate: float | None = None
    monthly_patrimonial_return: float | None = None
    amortization_rate: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    total_invested: float | None = None
    cash: float | None = None
    liquidity_needs: float | None = None
    government_bonds: float | None = None
    private_bonds: float | None = None
    fixed_income_funds: float | None = None
    real_estate: float | None = None
    real_estate_company_shares: float | None = None
    real_estate_company_units: float | None = None
    cri: float | None = None
    lci: float | None = None
    fii_holdings: float | None = None
    receivables: float | None = None
    rental_receivables: float | None = None
    other_receivables: float | None = None
    distributions_payable: float | None = None
    admin_fees_payable: float | None = None
    real_estate_obligations: float | None = None
    total_liabilities: float | None = None


@dataclass(frozen=True, kw_only=True)
class FIIPropertySummary:
    """The fund's buildings, added up, as of one quarter.

    ``vacancy_rate`` is the fund's consolidated vacancy and
    ``average_vacancy_rate`` the plain average across buildings. They answer
    different questions -- one empty warehouse among thirty moves the second far
    more than the first -- so both are carried rather than picking one.
    """

    count: int | None = None
    #: Square metres.
    total_area: float | None = None
    vacancy_rate: float | None = None
    average_vacancy_rate: float | None = None
    properties_with_vacancy: int | None = None


@dataclass(frozen=True, kw_only=True)
class FIIProperty:
    """One building the fund owns, as described in the quarterly filing.

    The construction fields are filled only by funds still building something,
    and ``leased_rate`` and ``sold_rate`` only by those selling or leasing what
    they built. A finished income property leaves all of them absent, which is
    why none of them is defaulted to zero.

    ``confidential`` is the fund's own flag for a building it does not name;
    when it is set the description is deliberately empty rather than missing.
    """

    name: str | None = None
    identifier: str | None = None
    address: str | None = None
    property_class: str | None = None
    #: Square metres.
    area: float | None = None
    unit_count: int | None = None
    vacancy_rate: float | None = None
    delinquency_rate: float | None = None
    #: How much of the fund's revenue this one building answers for.
    revenue_share: float | None = None
    leased_rate: float | None = None
    sold_rate: float | None = None
    construction_progress_actual: float | None = None
    construction_progress_expected: float | None = None
    construction_cost_actual: float | None = None
    construction_cost_expected: float | None = None
    invested_share: float | None = None
    confidential: bool | None = None


@dataclass(frozen=True, kw_only=True)
class FIIHolding:
    """One financial asset the fund holds: a CRI, a share in another fund.

    Both are described the same way upstream and are kept apart by which list
    they arrive in, not by their shape.
    """

    asset_class: str | None = None
    name: str | None = None
    issuer: str | None = None
    issuer_cnpj: str | None = None
    identifier: str | None = None
    quantity: float | None = None
    value: float | None = None
    issue: str | None = None
    series: str | None = None
    ticker: str | None = None
    maturity_date: date | None = None
    confidential: bool | None = None


@dataclass(frozen=True, kw_only=True)
class FIILand:
    """A plot of land the fund holds, with no building on it yet."""

    name: str | None = None
    identifier: str | None = None
    address: str | None = None
    #: Square metres.
    area: float | None = None
    invested_share: float | None = None
    equity_share: float | None = None
    confidential: bool | None = None


@dataclass(frozen=True, kw_only=True)
class FIIRight:
    """A right over real estate -- to build, to receive, to buy."""

    name: str | None = None
    identifier: str | None = None
    value: float | None = None
    description: str | None = None
    confidential: bool | None = None


@dataclass(frozen=True, kw_only=True)
class FIIAllocation:
    """How much of one asset class the fund held, in a quarter.

    ``value`` is absent for the buildings: the quarterly filing counts them and
    describes them one by one, but declares no price for them. A reader adding
    the values up is therefore adding up the paper, not the fund.
    """

    asset_class: str
    count: int | None = None
    value: float | None = None


@dataclass(frozen=True, kw_only=True)
class FIICompositionSummary:
    """One quarter's composition, added up by kind of asset."""

    total_items: int | None = None
    declared_value: float | None = None
    properties: FIIPropertySummary | None = None
    financial_assets_count: int | None = None
    financial_assets_value: float | None = None
    lands_count: int | None = None
    #: Square metres.
    lands_area: float | None = None
    rights_count: int | None = None
    rights_value: float | None = None


@dataclass(frozen=True, kw_only=True)
class FIIComposition:
    """What the fund held at the end of a quarter, item by item.

    Filed quarterly and published months later, so ``reference_date`` is not
    decoration: this is the most recent picture available, not the current one.
    """

    reference_date: date | None = None
    summary: FIICompositionSummary | None = None
    allocations: list[FIIAllocation] = field(default_factory=list)
    properties: list[FIIProperty] = field(default_factory=list)
    financial_assets: list[FIIHolding] = field(default_factory=list)
    fund_holdings: list[FIIHolding] = field(default_factory=list)
    lands: list[FIILand] = field(default_factory=list)
    rights: list[FIIRight] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class FIICompositionPoint:
    """One quarter of the composition history: the totals, not the items."""

    reference_date: date | None = None
    summary: FIICompositionSummary | None = None
    allocations: list[FIIAllocation] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class FIIPropertiesPoint:
    """One quarter of the buildings history: how many, how large, how empty."""

    reference_date: date | None = None
    summary: FIIPropertySummary | None = None


def _serialize(value: Any) -> Any:
    """A value the profile cache can hold, since it is stored as JSON.

    Dates become ISO strings and dataclasses become dicts, recursively. The two
    shapes that predate this write their own ``to_dict`` and are used through
    it, so each of them still has one place that says what it publishes.
    """
    if hasattr(value, 'to_dict'):
        return value.to_dict()
    if isinstance(value, date):
        return value.isoformat()
    if is_dataclass(value) and not isinstance(value, type):
        return {item.name: _serialize(getattr(value, item.name)) for item in fields(value)}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


@dataclass(frozen=True, kw_only=True)
class FIIProfile:
    """Everything a fund publishes about itself, in one read.

    Each part comes from a provider route of its own and any of them may be
    absent: one route failing costs the page that section and leaves the rest,
    rather than emptying the page. Only every route failing means the profile
    could not be read at all.
    """

    ticker: str
    management: FIIManagement | None = None
    indicators: FIIIndicators | None = None
    #: The same indicators, month by month, oldest first.
    indicators_history: list[FIIIndicators] = field(default_factory=list)
    dividends: list[FIIDividend] = field(default_factory=list)
    #: The most recent monthly filing.
    monthly_report: FIIMonthlyReport | None = None
    #: The most recent quarterly filing, item by item.
    composition: FIIComposition | None = None
    #: Its totals per quarter, oldest first.
    composition_history: list[FIICompositionPoint] = field(default_factory=list)
    properties_history: list[FIIPropertiesPoint] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            'ticker': self.ticker,
            'management': _serialize(self.management),
            'indicators': self.indicators.to_dict() if self.indicators else None,
            'indicators_history': [item.to_dict() for item in self.indicators_history],
            'dividends': [dividend.to_dict() for dividend in self.dividends],
            'monthly_report': _serialize(self.monthly_report),
            'composition': _serialize(self.composition),
            'composition_history': _serialize(self.composition_history),
            'properties_history': _serialize(self.properties_history),
        }
