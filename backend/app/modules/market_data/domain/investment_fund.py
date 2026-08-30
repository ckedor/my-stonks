"""The published profile of an investment fund that is not a FII or an ETF.

A FIAGRO, a FI-Infra, a FIDC, a FIP and an ordinary FIF are all funds, and none
of them is a real-estate fund: they hold paper, receivables and stakes in
companies rather than buildings, so there is no vacancy to read and no property
to describe. What they publish instead is a share value, an equity, a body of
shareholders, and -- for the ones the regulator asks it of -- a monthly picture
of who holds the fund and how much risk it carries.

Nothing here is persisted, for the same reason nothing of the FII profile is: a
fund republishes these numbers on its own calendar, the application keeps no
history of them, and a stale copy would be worse than asking the provider.

The parts arrive on different clocks. The registration and the current
indicators are refreshed daily for a FIF and monthly for a FIDC; the share
value is filed daily by an FI and monthly by a FIDC; the regulatory profile is
monthly; the portfolio is quarterly and lands months late. Each part carries
the date it refers to, because a concentration figure read without its month is
a number about nothing.

Every figure is optional, and an absent one is ``None`` rather than zero. The
provider fills very little for some fund kinds, and a fund whose monthly return
it does not publish has an unknown return -- which is a different statement from
a return of zero.
"""

from __future__ import annotations

from dataclasses import dataclass, field, fields, is_dataclass
from datetime import date
from typing import Any

#: What the provider labels an ordinary distribution. Funds also amortize
#: capital, which arrives through the same route under its own label and is a
#: return of principal rather than income -- the two are kept apart rather than
#: added together, exactly as they are for a real-estate fund.
INCOME_EVENT_LABEL = 'RENDIMENTO'

#: The kinds of fund this profile is about. A FII has a profile of its own,
#: built from buildings and vacancy, and an ETF is read as any listed asset is,
#: so neither belongs here even though the provider answers for both from the
#: same catalogue.
EXCLUDED_FUND_KINDS = frozenset({'fii', 'etf'})


@dataclass(frozen=True, kw_only=True)
class InvestmentFundIdentity:
    """What the fund is, on paper: its registration and who runs it.

    ``kind`` is the family the fund belongs to -- ``fiagro``, ``fidc``,
    ``fiinfra``, ``fif``, ``fip`` -- and it decides what the rest of the profile
    can even contain: a FIDC files monthly share values and no daily ones, a FIP
    files neither. It is carried in the provider's lower-case spelling and named
    on screen, never shown raw.

    The three classifications come from three different bodies and disagree on
    purpose, so none of them stands for the others.
    """

    cnpj: str | None = None
    legal_name: str | None = None
    kind: str | None = None
    isin: str | None = None
    cvm_class_type: str | None = None
    cvm_classification: str | None = None
    anbima_classification: str | None = None
    b3_classification: str | None = None
    administrator_name: str | None = None
    administrator_cnpj: str | None = None
    manager_name: str | None = None
    manager_cnpj: str | None = None
    #: Whether the fund is still running, in the registry's own words.
    status: str | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundIndicators:
    """What the fund reports about itself, as of its last filing.

    ``nav_per_share`` is what a share is worth by the fund's own accounting and
    ``price`` is what it trades for; they are different numbers and their ratio
    is ``price_to_nav``, published as a multiple around 1 and never recomputed
    here. Below 1 the share trades at a discount to the fund's own valuation.

    ``monthly_return``, ``patrimonial_monthly_return`` and
    ``dividend_yield_monthly`` are ratios, not percentages: 0.0142 is 1.42%.
    The first is what the fund returned to a holder and the second what its
    equity did; a fund that distributed heavily separates them.

    ``daily_applications`` and ``daily_redemptions`` are the money that came in
    and went out on the reference day, in reais. A closed-end fund files zero
    for both because nobody can subscribe or redeem, which is a fact about the
    fund and not a gap in the data.
    """

    as_of_date: date | None = None
    price: float | None = None
    #: Valor patrimonial por cota.
    nav_per_share: float | None = None
    #: P/VP, as published. Never recomputed from price and NAV.
    price_to_nav: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    shareholders: int | None = None
    daily_applications: float | None = None
    daily_redemptions: float | None = None
    shares_outstanding: float | None = None
    monthly_return: float | None = None
    patrimonial_monthly_return: float | None = None
    dividend_yield_monthly: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'as_of_date': self.as_of_date.isoformat() if self.as_of_date else None,
            'price': self.price,
            'nav_per_share': self.nav_per_share,
            'price_to_nav': self.price_to_nav,
            'equity': self.equity,
            'total_assets': self.total_assets,
            'shareholders': self.shareholders,
            'daily_applications': self.daily_applications,
            'daily_redemptions': self.daily_redemptions,
            'shares_outstanding': self.shares_outstanding,
            'monthly_return': self.monthly_return,
            'patrimonial_monthly_return': self.patrimonial_monthly_return,
            'dividend_yield_monthly': self.dividend_yield_monthly,
        }


@dataclass(frozen=True, kw_only=True)
class InvestmentFundNavPoint:
    """One filing of the share value, with the equity behind it.

    An FI or FIF files this daily and a FIDC monthly, per class or series -- so
    ``class_or_series`` is part of what identifies a row and not decoration. It
    is the fund's own accounting, not its market price: a share that has not
    traded in a week still has a share value filed every day.

    ``monthly_return`` is the return the regulator publishes for the month, and
    only the monthly filers carry it.
    """

    date: date
    class_or_series: str | None = None
    nav_per_share: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    shareholders: int | None = None
    daily_applications: float | None = None
    daily_redemptions: float | None = None
    monthly_return: float | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundDividend:
    """One payment per share made by the fund.

    ``event_type`` is the provider's own label, carried through because it is
    the only thing separating income from an amortization of capital. Readers
    that mean income filter on it; nothing here decides that for them.

    The three dates answer three different questions and none is derivable from
    the others: when the payment was declared, who had the right to it, and when
    the cash arrived. The provider states plainly that it does not estimate a
    payment date from a fixed interval, because funds of these kinds do not have
    one -- so no periodicity may be inferred from the series either.
    """

    payment_date: date
    value_per_share: float
    #: The date that settled who had the right to the payment.
    ex_date: date | None = None
    declared_date: date | None = None
    event_type: str | None = None

    @property
    def is_income(self) -> bool:
        """Whether this is a distribution of income rather than of capital.

        A payment carrying no label at all is read as income: that is what these
        routes overwhelmingly return, and dropping every unlabelled one would
        empty the history of the funds whose labels the provider leaves blank.
        """
        return self.event_type is None or self.event_type.upper() == INCOME_EVENT_LABEL

    def to_dict(self) -> dict[str, Any]:
        return {
            'payment_date': self.payment_date.isoformat(),
            'ex_date': self.ex_date.isoformat() if self.ex_date else None,
            'declared_date': self.declared_date.isoformat() if self.declared_date else None,
            'value_per_share': self.value_per_share,
            'event_type': self.event_type,
        }


@dataclass(frozen=True, kw_only=True)
class InvestmentFundInvestorBreakdown:
    """Who holds the fund, in the monthly filing.

    Counts and shares are both filed, and both are kept: one fund of funds
    holding 100% of a feeder is one investor and the whole of the equity, and
    either number alone tells half of that.
    """

    individual_retail: int | None = None
    individual_retail_percent: float | None = None
    legal_entities: int | None = None
    legal_entities_percent: float | None = None
    funds_or_clubs: int | None = None
    funds_or_clubs_percent: float | None = None
    non_residents: int | None = None
    non_residents_percent: float | None = None
    other: int | None = None
    other_percent: float | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundRisk:
    """How the fund measures its own risk, in the monthly filing.

    ``risk_model`` is the method the administrator declares having used, and it
    is what makes the numbers beside it comparable or not: a VaR from a
    non-parametric model and one from a parametric model are not the same
    quantity, so the model travels with them.

    The variation figures are the regulator's percentages, carried as filed.
    """

    risk_model: str | None = None
    portfolio_var: float | None = None
    daily_quota_variation_percent: float | None = None
    stressed_daily_quota_variation_percent: float | None = None
    private_credit_exposure_percent: float | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundRegulatoryProfile:
    """The monthly picture the administrator files with the regulator.

    Only the funds the regulator asks it of file one -- an FI and an FIF do, a
    FIP does not -- so an absent profile is a fact about the fund's kind rather
    than a failure to read it.

    The liquidity section the provider documents has no published shape and
    arrives null for the funds seen so far, so nothing here claims to know what
    it contains. It stays out until there is a payload to map, rather than
    entering as invented field names that would read as data.
    """

    reference_date: date | None = None
    investors: InvestmentFundInvestorBreakdown | None = None
    risk: InvestmentFundRisk | None = None
    #: How much of the equity the single largest holder answers for.
    top_investor_percent: float | None = None
    private_credit_exposure_percent: float | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundHolding:
    """One line of the quarterly portfolio filing.

    Every group the filing uses -- public bonds, shares in other funds, credit
    assets, listed securities, receivables and payables -- is described in this
    same shape, and ``bucket`` is what says which group a line came from. The
    last two are claims and obligations rather than things owned, which is
    exactly why the group has to travel with the line: added up blindly, a
    payable would inflate what the fund holds.

    ``confidential`` is the fund's own flag for a position it does not name.
    When it is set the description is deliberately empty rather than missing,
    and such positions arrive already aggregated upstream.

    ``details`` is whatever else the filing said about the line. Its keys vary
    by group and by fund, so it is carried as filed and never promoted into
    fields that would be absent for most rows.
    """

    bucket: str
    asset_type: str | None = None
    asset_name: str | None = None
    issuer_name: str | None = None
    issuer_cnpj: str | None = None
    isin: str | None = None
    selic_code: str | None = None
    quantity: float | None = None
    market_value: float | None = None
    cost_value: float | None = None
    maturity_date: date | None = None
    confidential: bool | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, kw_only=True)
class InvestmentFundPortfolioSummary:
    """The quarterly filing added up, by group.

    ``market_value`` is the filing's own total and is not the sum of the six
    groups below it: receivables add to it and payables subtract from it, so
    re-deriving it here would produce a different, plausible-looking number.
    """

    market_value: float | None = None
    holdings_count: int | None = None
    public_bonds_value: float | None = None
    fund_holdings_value: float | None = None
    credit_assets_value: float | None = None
    listed_securities_value: float | None = None
    receivables_value: float | None = None
    payables_value: float | None = None


@dataclass(frozen=True, kw_only=True)
class InvestmentFundPortfolio:
    """What the fund held at the end of a quarter, line by line.

    Filed quarterly and published months later, so ``reference_date`` is not
    decoration: this is the most recent picture available, not the current one.
    """

    reference_date: date | None = None
    summary: InvestmentFundPortfolioSummary | None = None
    holdings: list[InvestmentFundHolding] = field(default_factory=list)


def _serialize(value: Any) -> Any:
    """A value the profile cache can hold, since it is stored as JSON.

    Dates become ISO strings and dataclasses become dicts, recursively. The
    shapes that write their own ``to_dict`` are used through it, so each of them
    still has one place that says what it publishes.
    """
    if hasattr(value, 'to_dict'):
        return value.to_dict()
    if isinstance(value, date):
        return value.isoformat()
    if is_dataclass(value) and not isinstance(value, type):
        return {item.name: _serialize(getattr(value, item.name)) for item in fields(value)}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    return value


@dataclass(frozen=True, kw_only=True)
class InvestmentFundProfile:
    """Everything a fund publishes about itself, in one read.

    Each part comes from a provider route of its own and any of them may be
    absent: one route failing costs the page that section and leaves the rest,
    rather than emptying the page. Only every route failing means the profile
    could not be read at all.
    """

    ticker: str
    identity: InvestmentFundIdentity | None = None
    indicators: InvestmentFundIndicators | None = None
    #: The share value filed over time, oldest first.
    nav_history: list[InvestmentFundNavPoint] = field(default_factory=list)
    dividends: list[InvestmentFundDividend] = field(default_factory=list)
    #: The most recent monthly filing with the regulator.
    regulatory_profile: InvestmentFundRegulatoryProfile | None = None
    #: The most recent quarterly portfolio filing.
    portfolio: InvestmentFundPortfolio | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            'ticker': self.ticker,
            'identity': _serialize(self.identity),
            'indicators': self.indicators.to_dict() if self.indicators else None,
            'nav_history': _serialize(self.nav_history),
            'dividends': [dividend.to_dict() for dividend in self.dividends],
            'regulatory_profile': _serialize(self.regulatory_profile),
            'portfolio': _serialize(self.portfolio),
        }
