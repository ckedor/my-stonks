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


class FIIManagementResponse(BaseModel):
    """Who runs the fund and under which mandate."""

    cnpj: str | None = None
    mandate: str | None = None
    management_type: str | None = None
    administrator_name: str | None = None
    administrator_website: str | None = None


class FIIMonthlyReportResponse(BaseModel):
    """The monthly filing: what the fund's equity is made of, in reais.

    The rates are ratios like everywhere else here, and the monetary fields are
    absolute amounts, not per share. Indicators the filing repeats are served by
    ``FIIIndicatorsResponse`` instead of being restated under a second name.
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


class FIIPropertySummaryResponse(BaseModel):
    """The fund's buildings added up, as of one quarter.

    ``vacancy_rate`` is consolidated and ``average_vacancy_rate`` is the plain
    average across buildings; areas are in square metres.
    """

    count: int | None = None
    total_area: float | None = None
    vacancy_rate: float | None = None
    average_vacancy_rate: float | None = None
    properties_with_vacancy: int | None = None


class FIIPropertyResponse(BaseModel):
    """One building, as the fund described it in the quarterly filing."""

    name: str | None = None
    identifier: str | None = None
    address: str | None = None
    property_class: str | None = None
    area: float | None = None
    unit_count: int | None = None
    vacancy_rate: float | None = None
    delinquency_rate: float | None = None
    revenue_share: float | None = None
    leased_rate: float | None = None
    sold_rate: float | None = None
    construction_progress_actual: float | None = None
    construction_progress_expected: float | None = None
    construction_cost_actual: float | None = None
    construction_cost_expected: float | None = None
    invested_share: float | None = None
    confidential: bool | None = None


class FIIHoldingResponse(BaseModel):
    """One financial asset the fund holds: a CRI, a share in another fund."""

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


class FIILandResponse(BaseModel):
    name: str | None = None
    identifier: str | None = None
    address: str | None = None
    area: float | None = None
    invested_share: float | None = None
    equity_share: float | None = None
    confidential: bool | None = None


class FIIRightResponse(BaseModel):
    name: str | None = None
    identifier: str | None = None
    value: float | None = None
    description: str | None = None
    confidential: bool | None = None


class FIIAllocationResponse(BaseModel):
    """How much of one asset class the fund held.

    ``value`` is absent for the buildings: the quarterly filing counts and
    describes them, but declares no price for them.
    """

    asset_class: str
    count: int | None = None
    value: float | None = None


class FIICompositionSummaryResponse(BaseModel):
    total_items: int | None = None
    declared_value: float | None = None
    properties: FIIPropertySummaryResponse | None = None
    financial_assets_count: int | None = None
    financial_assets_value: float | None = None
    lands_count: int | None = None
    lands_area: float | None = None
    rights_count: int | None = None
    rights_value: float | None = None


class FIICompositionResponse(BaseModel):
    """What the fund held at the end of the last quarter it filed for."""

    reference_date: date | None = None
    summary: FIICompositionSummaryResponse | None = None
    allocations: list[FIIAllocationResponse] = []
    properties: list[FIIPropertyResponse] = []
    financial_assets: list[FIIHoldingResponse] = []
    fund_holdings: list[FIIHoldingResponse] = []
    lands: list[FIILandResponse] = []
    rights: list[FIIRightResponse] = []


class FIICompositionPointResponse(BaseModel):
    """One quarter of the composition history: the totals, not the items."""

    reference_date: date | None = None
    summary: FIICompositionSummaryResponse | None = None
    allocations: list[FIIAllocationResponse] = []


class FIIPropertiesPointResponse(BaseModel):
    reference_date: date | None = None
    summary: FIIPropertySummaryResponse | None = None


class FIIProfileResponse(BaseModel):
    """Everything the fund publishes about itself.

    Every section is optional and independent: the provider answers each from a
    route of its own, and one of them failing costs the page that section
    rather than the whole profile. The monthly sections and the quarterly ones
    also carry different dates, which is why each states its own.
    """

    ticker: str
    management: FIIManagementResponse | None = None
    indicators: FIIIndicatorsResponse | None = None
    indicators_history: list[FIIIndicatorsResponse] = []
    dividends: list[FIIDividendResponse] = []
    monthly_report: FIIMonthlyReportResponse | None = None
    composition: FIICompositionResponse | None = None
    composition_history: list[FIICompositionPointResponse] = []
    properties_history: list[FIIPropertiesPointResponse] = []


class FIIMarketFundResponse(BaseModel):
    asset_id: int | None = None
    ticker: str
    name: str
    cnpj: str | None = None
    type: str | None = None
    segment: str | None = None
    mandate: str | None = None
    management_type: str | None = None
    administrator: str | None = None
    price: float | None = None
    nav_per_share: float | None = None
    price_to_nav: float | None = None
    dividend_yield_12m: float | None = None
    investors: int | None = None


class FIIMarketResponse(BaseModel):
    funds: list[FIIMarketFundResponse]
    total: int
    source: str
