"""Investment-fund profile schemas.

An investment fund here is one that is neither a real-estate fund nor an ETF: a
FIAGRO, an FI-Infra, a FIDC, a FIP or an ordinary FIF. The two exceptions have
readings of their own — a FII publishes buildings and vacancy, an ETF is read
like any listed asset — and neither is served by these shapes.
"""

from datetime import date
from typing import Any

from pydantic import BaseModel


class InvestmentFundIdentityResponse(BaseModel):
    """What the fund is, on paper: its registration and who runs it.

    ``kind`` is the family the fund belongs to — ``fiagro``, ``fidc``,
    ``fiinfra``, ``fif``, ``fip`` — and it decides what the rest of the profile
    can contain: a FIDC files monthly share values and no daily ones, a FIP
    files neither. The three classifications come from three different bodies
    and disagree on purpose, so none stands for the others.
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
    status: str | None = None


class InvestmentFundIndicatorsResponse(BaseModel):
    """The fund's own numbers, as of the filing they came from.

    The returns and the yield are ratios: 0.0142 is 1.42%. ``price_to_nav`` is
    the published P/VP, a multiple around 1 — below it the share trades for less
    than the fund says it is worth. None of them is scaled here; the client
    decides how each is written.

    ``daily_applications`` and ``daily_redemptions`` are the money that came in
    and went out on the reference day, in reais. A closed-end fund files zero
    for both because nobody can subscribe or redeem.
    """

    as_of_date: date | None = None
    price: float | None = None
    nav_per_share: float | None = None
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


class InvestmentFundNavPointResponse(BaseModel):
    """One filing of the share value, with the equity behind it.

    It is the fund's own accounting and not its market price: a share that has
    not traded in a week still has a share value filed every day. A FIDC files
    per class or series, so ``class_or_series`` is part of what identifies a row.
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


class InvestmentFundDividendResponse(BaseModel):
    """One payment per share, as published.

    ``event_type`` is what the fund called it — an ordinary distribution or an
    amortization of capital. It is carried so that a reader meaning income can
    tell the two apart instead of adding them up.

    The provider does not estimate a payment date from a fixed interval, since
    funds of these kinds have none, so no periodicity may be read into the
    series either.
    """

    payment_date: date
    ex_date: date | None = None
    declared_date: date | None = None
    value_per_share: float
    event_type: str | None = None


class InvestmentFundInvestorBreakdownResponse(BaseModel):
    """Who holds the fund, in the monthly filing.

    Counts and shares are both served: one feeder fund is one investor and the
    whole of the equity, and either number alone tells half of that.
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


class InvestmentFundRiskResponse(BaseModel):
    """How the fund measures its own risk, in the monthly filing.

    ``risk_model`` is what makes the numbers beside it comparable or not: a VaR
    from a non-parametric model and one from a parametric model are not the same
    quantity, so the model travels with them.
    """

    risk_model: str | None = None
    portfolio_var: float | None = None
    daily_quota_variation_percent: float | None = None
    stressed_daily_quota_variation_percent: float | None = None
    private_credit_exposure_percent: float | None = None


class InvestmentFundRegulatoryProfileResponse(BaseModel):
    """The most recent monthly filing with the regulator.

    Only the funds the regulator asks it of file one, so an absent profile is a
    fact about the fund's kind rather than a failure to read it.
    """

    reference_date: date | None = None
    investors: InvestmentFundInvestorBreakdownResponse | None = None
    risk: InvestmentFundRiskResponse | None = None
    top_investor_percent: float | None = None
    private_credit_exposure_percent: float | None = None


class InvestmentFundHoldingResponse(BaseModel):
    """One line of the quarterly portfolio filing.

    ``bucket`` says which group the line came from — ``public_bonds``,
    ``fund_holdings``, ``credit_assets``, ``listed_securities``, ``receivables``
    or ``payables``. The last two are claims and obligations rather than things
    owned, which is why the group travels with the line: added up blindly, a
    payable would inflate what the fund holds.

    ``details`` is whatever else the filing said. Its keys vary by group and by
    fund, so it is served as filed rather than promoted into fields that would
    be absent for most rows.
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
    details: dict[str, Any] = {}


class InvestmentFundPortfolioSummaryResponse(BaseModel):
    """The quarterly filing added up, by group.

    ``market_value`` is the filing's own total and is not the sum of the six
    groups below it: receivables add to it and payables subtract from it.
    """

    market_value: float | None = None
    holdings_count: int | None = None
    public_bonds_value: float | None = None
    fund_holdings_value: float | None = None
    credit_assets_value: float | None = None
    listed_securities_value: float | None = None
    receivables_value: float | None = None
    payables_value: float | None = None


class InvestmentFundPortfolioResponse(BaseModel):
    """What the fund held at the end of the last quarter it filed for."""

    reference_date: date | None = None
    summary: InvestmentFundPortfolioSummaryResponse | None = None
    holdings: list[InvestmentFundHoldingResponse] = []


class InvestmentFundProfileResponse(BaseModel):
    """Everything the fund publishes about itself.

    Every section is optional and independent: the provider answers each from a
    route of its own, and one of them failing costs the page that section rather
    than the whole profile. The sections also arrive on different clocks — the
    share value daily or monthly, the regulatory profile monthly, the portfolio
    quarterly and months late — which is why each states its own date.
    """

    ticker: str
    identity: InvestmentFundIdentityResponse | None = None
    indicators: InvestmentFundIndicatorsResponse | None = None
    nav_history: list[InvestmentFundNavPointResponse] = []
    dividends: list[InvestmentFundDividendResponse] = []
    regulatory_profile: InvestmentFundRegulatoryProfileResponse | None = None
    portfolio: InvestmentFundPortfolioResponse | None = None


class InvestmentFundMarketFundResponse(BaseModel):
    """One fund in the catalogue, summarized.

    ``asset_id`` is filled only for funds registered in the application, and it
    is what makes a row open a page — the rest of the catalogue is readable but
    has nothing to open.
    """

    asset_id: int | None = None
    ticker: str
    name: str
    cnpj: str | None = None
    kind: str | None = None
    b3_classification: str | None = None
    anbima_classification: str | None = None
    administrator: str | None = None
    manager: str | None = None
    price: float | None = None
    nav_per_share: float | None = None
    price_to_nav: float | None = None
    equity: float | None = None
    total_assets: float | None = None
    investors: int | None = None


class InvestmentFundMarketResponse(BaseModel):
    funds: list[InvestmentFundMarketFundResponse]
    total: int
    source: str
