"""Listed-company profile schemas."""

from datetime import date

from pydantic import BaseModel


class StockCompanyResponse(BaseModel):
    """The business behind the ticker.

    The classification comes twice: ``sector``/``industry`` are for reading and
    ``sector_key``/``industry_key`` are stable slugs meant for grouping. The
    summary arrives already split into the paragraphs the company wrote.
    """

    name: str | None = None
    sector: str | None = None
    sector_key: str | None = None
    industry: str | None = None
    industry_key: str | None = None
    website: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    employees: int | None = None
    cnpj: str | None = None
    founded_on: date | None = None
    logo_url: str | None = None
    summary_paragraphs: list[str] = []


class StockPriceRangeResponse(BaseModel):
    """The quote and the band the year drew around it.

    ``day_change`` is a ratio like every other proportion here: 0.0199 is
    +1,99%. The provider states this one in percentage points and it is divided
    on the way in, so that nothing downstream has to know which route wrote it.
    """

    price: float | None = None
    previous_close: float | None = None
    day_change: float | None = None
    day_low: float | None = None
    day_high: float | None = None
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None
    market_cap: float | None = None
    volume: float | None = None
    as_of: date | None = None


class StockStatisticsResponse(BaseModel):
    """What the market pays for the company.

    The multiples are as the provider publishes them and are never recomputed
    from price and earnings. ``dividend_yield``, ``profit_margin`` and
    ``fifty_two_week_change`` are ratios: 0.08 is 8%.
    """

    market_cap: float | None = None
    enterprise_value: float | None = None
    trailing_pe: float | None = None
    forward_pe: float | None = None
    price_to_book: float | None = None
    book_value_per_share: float | None = None
    earnings_per_share: float | None = None
    forward_earnings_per_share: float | None = None
    peg_ratio: float | None = None
    beta: float | None = None
    dividend_yield: float | None = None
    profit_margin: float | None = None
    net_income: float | None = None
    earnings_quarterly_growth: float | None = None
    enterprise_to_revenue: float | None = None
    enterprise_to_ebitda: float | None = None
    shares_outstanding: float | None = None
    float_shares: float | None = None
    fifty_two_week_change: float | None = None
    most_recent_quarter: date | None = None
    last_dividend_value: float | None = None
    last_dividend_date: date | None = None


class StockFundamentalsResponse(BaseModel):
    """How the business did, before the market had an opinion.

    Margins, returns and growth are ratios. ``earnings_growth`` and
    ``revenue_growth`` compare a quarter to the same quarter a year earlier;
    the ``annual_`` pair compares years, and the two are far apart enough that
    a screen has to say which it is showing.
    """

    revenue: float | None = None
    gross_profit: float | None = None
    ebitda: float | None = None
    total_cash: float | None = None
    cash_per_share: float | None = None
    total_debt: float | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    quick_ratio: float | None = None
    return_on_assets: float | None = None
    return_on_equity: float | None = None
    free_cash_flow: float | None = None
    operating_cash_flow: float | None = None
    gross_margin: float | None = None
    ebitda_margin: float | None = None
    operating_margin: float | None = None
    profit_margin: float | None = None
    earnings_growth: float | None = None
    revenue_growth: float | None = None
    annual_earnings_growth: float | None = None
    annual_revenue_growth: float | None = None


class StockCashDividendResponse(BaseModel):
    """A payment in money, per share.

    ``label`` tells a dividend from interest on own capital (``JCP``), which is
    taxed at source. ``last_date_prior`` is the last day the share carried the
    right; the ex date is the trading day after. ``payment_date`` is regularly
    in the future, because a company announces months ahead.
    """

    payment_date: date | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    value_per_share: float | None = None
    label: str | None = None
    related_to: str | None = None


class StockShareDividendResponse(BaseModel):
    """A payment in shares: a bonus issue or a split.

    It has a proportion and no amount, and never had a payment date -- which is
    why it is its own shape rather than a cash dividend with half its fields
    empty.
    """

    factor: float | None = None
    complete_factor: str | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    label: str | None = None


class StockSubscriptionResponse(BaseModel):
    """A right to subscribe new shares, which is neither of the other two."""

    factor: float | None = None
    complete_factor: str | None = None
    price: float | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    label: str | None = None


class StockStatementPointResponse(BaseModel):
    """One period of one filed statement, carrying only the lines it has.

    ``lines`` is a mapping and not a set of fields because the filers disagree
    on which lines exist: the provider answers each statement with every line
    any Brazilian filer might report -- 128 for the balance sheet -- and a bank
    fills a different 31 of them than an oil company fills 65, with 16 in
    common. Declared as fields, three quarters of the contract would be null for
    any one company. Keys are the provider's line names in snake_case, and a
    line the company did not file is absent rather than zero.

    ``period`` is what the filer called it -- ``quarterly``, ``yearly`` --
    echoed rather than normalized.
    """

    end_date: date | None = None
    period: str | None = None
    lines: dict[str, float] = {}


class StockProfileResponse(BaseModel):
    """Everything a listed company publishes about itself.

    Every section is optional and independent: the provider answers each from a
    route of its own, and one of them failing costs the page that section rather
    than the whole profile. The series run oldest first.

    ``ticker`` is what was asked for and ``resolved_ticker`` is what the market
    calls it now; ``renamed`` says the two differ, so a reader who lands on a
    page under an unfamiliar code is told why.
    """

    ticker: str
    resolved_ticker: str | None = None
    renamed: bool = False
    company: StockCompanyResponse | None = None
    price_range: StockPriceRangeResponse | None = None
    statistics: StockStatisticsResponse | None = None
    fundamentals: StockFundamentalsResponse | None = None
    cash_dividends: list[StockCashDividendResponse] = []
    share_dividends: list[StockShareDividendResponse] = []
    subscriptions: list[StockSubscriptionResponse] = []
    income_statement: list[StockStatementPointResponse] = []
    balance_sheet: list[StockStatementPointResponse] = []
    cash_flow: list[StockStatementPointResponse] = []
    value_added: list[StockStatementPointResponse] = []
