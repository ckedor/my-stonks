"""The published profile of a listed company.

A share is not a fund. What a fund publishes about itself is a share value and
a portfolio; what a company publishes is a result, a balance and a cash flow,
and the market prices those into a multiple. So the profile here is built from
what the company filed and what the market pays for it, and the reading a
screen makes of the two -- expensive or cheap against how good the business is
-- is the reason both live in the same object.

Nothing is persisted, for the same reason nothing of the fund profiles is: a
company refiles on its own calendar, the application keeps no history of these
numbers, and a stale copy would be worse than asking the provider.

Two conventions had to be reconciled at the door, and both bit at parse time
rather than on screen:

- **Everything ratio-like is a ratio here.** The quote route states a daily
  change in percentage points (``-1.39`` is −1,39%) while the statistics and
  financial-data routes state margins and yields as fractions (``0.03`` is 3%).
  Carrying both would leave the screen to remember which is which, and writing
  300% where there is 3% is exactly what that forgetting looks like.
- **Series run oldest first.** The statement routes answer newest first, and a
  chart wants the other order. Reversing once here is cheaper than every reader
  remembering to.

Every figure is optional, and an absent one is ``None`` rather than zero. A
company whose profit margin the provider does not publish has an unknown
margin, which is a different statement from a margin of zero.
"""

from __future__ import annotations

from dataclasses import dataclass, field, fields, is_dataclass
from datetime import date
from typing import Any

#: What the provider calls a payment of interest on own capital, which is taxed
#: at source, against an ordinary dividend, which is not. The two arrive through
#: the same route under the same shape and are told apart only by this label, so
#: a reader adding up net income needs it carried rather than normalized away.
INTEREST_ON_EQUITY_LABEL = 'JCP'


@dataclass(frozen=True, kw_only=True)
class StockCompany:
    """The business behind the ticker: what it does and where it does it.

    The classification comes twice on purpose. ``sector`` and ``industry`` are
    for reading; ``sector_key`` and ``industry_key`` are the provider's stable
    slugs, and grouping or filtering is done on those -- a display label is
    retranslated and reworded, a slug is not.

    The summary arrives as one string with blank lines between paragraphs. It is
    split here rather than on screen because a paragraph break is part of what
    the company wrote, not a rendering choice.

    The registrar block the provider carries for funds is deliberately absent:
    it is null for every company, and fourteen empty rows are worse than no
    section at all.
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
    summary_paragraphs: list[str] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class StockPriceRange:
    """Where the price sits in the year, which is the cheapest context there is.

    A price alone says nothing about whether it is high; the same price is a
    ceiling for one company and a floor for another. The band the year drew is
    what makes it readable, and it is the one thing here that comes from the
    quote route rather than from a filing.
    """

    price: float | None = None
    previous_close: float | None = None
    #: A ratio, like every other proportion in this module.
    day_change: float | None = None
    day_low: float | None = None
    day_high: float | None = None
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None
    market_cap: float | None = None
    volume: float | None = None
    as_of: date | None = None


@dataclass(frozen=True, kw_only=True)
class StockStatistics:
    """What the market pays for the company, and against what.

    The multiples are carried as the provider publishes them and are never
    recomputed from price and earnings here. Recomputing would produce a third
    number that disagrees with the two already on the page, and the reader has
    no way to tell which of the three is the one the market quotes.

    The fund block and the short-interest block the route also returns are
    dropped: the first only means something for an ETF, and the second is
    unpublished for the whole Brazilian market. A tile that is always empty
    teaches the reader to stop looking at the row it sits in.
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
    #: A ratio: 0.08 is 8%.
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


@dataclass(frozen=True, kw_only=True)
class StockFundamentals:
    """How the business actually did, before the market had an opinion.

    ``profit_margin`` is published by two routes at once. It is read from this
    one and only this one, so that the number under "margem" and the number
    behind it in every other card cannot drift apart by a rounding.

    The analyst-consensus block the route returns -- target prices, a
    recommendation, an opinion count -- is dropped whole: the provider does not
    cover Brazil for it and every field is null. A price-target card built on it
    would be a card that never fills.
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
    #: The quarter against the same quarter a year earlier.
    earnings_growth: float | None = None
    revenue_growth: float | None = None
    #: The year against the year before.
    annual_earnings_growth: float | None = None
    annual_revenue_growth: float | None = None


@dataclass(frozen=True, kw_only=True)
class StockCashDividend:
    """A payment in money, per share.

    ``label`` separates a dividend from interest on own capital, and the two are
    not interchangeable: the second is taxed at source, so a reader who means
    income received cannot add them up without knowing which is which.

    ``last_date_prior`` is the last day the share carried the right to it; the
    ex date is the trading day after. ``payment_date`` is regularly in the
    future -- a company announces months ahead -- and that is not an error to
    filter out.
    """

    payment_date: date | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    value_per_share: float | None = None
    label: str | None = None
    related_to: str | None = None


@dataclass(frozen=True, kw_only=True)
class StockShareDividend:
    """A payment in shares: a bonus issue or a split.

    It has a proportion and no amount, and it never had a payment date -- which
    is why it is its own shape rather than a cash dividend with half its fields
    empty. Folding the two together would force every consumer to ask which kind
    it is holding before reading any field.
    """

    factor: float | None = None
    complete_factor: str | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    label: str | None = None


@dataclass(frozen=True, kw_only=True)
class StockSubscription:
    """A right to subscribe new shares, which is neither of the other two."""

    factor: float | None = None
    complete_factor: str | None = None
    price: float | None = None
    last_date_prior: date | None = None
    approved_on: date | None = None
    label: str | None = None


@dataclass(frozen=True, kw_only=True)
class StockStatementPoint:
    """One period of one filed statement, carrying only the lines it has.

    The lines are a mapping and not fields, and that is a decision the data
    forced. The provider answers each statement with one flat record holding
    every line any Brazilian filer might report -- 128 of them for the balance
    sheet alone -- because a bank, an insurer and an oil company file different
    statements through the same route. Petrobras fills 65 of those and Itaú
    fills 31, and **only 16 are common to both**; 48 are empty for either.

    Declared as fields, that record would be two hundred columns of which any
    one company leaves three quarters null, in the domain, in the API schema and
    in the client type. As a mapping, a filer carries its own lines and nobody
    else's, and a statement the provider extends does not need a migration to
    reach the screen -- only a label.

    Keys are the provider's line names transliterated to snake_case, which is
    the convention every other contract in this application uses. Empty lines
    are dropped at parse: a line the company did not file is absent, never zero.
    """

    end_date: date | None = None
    #: What the provider called the period -- ``quarterly``, ``yearly``. Echoed
    #: rather than normalized, because it is the filer who decides it.
    period: str | None = None
    lines: dict[str, float] = field(default_factory=dict)


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
class StockProfile:
    """Everything a listed company publishes about itself, in one read.

    Each part comes from a provider route of its own and any of them may be
    absent: one route failing costs the page that section and leaves the rest,
    rather than emptying the page. Only every route failing means the profile
    could not be read at all.

    ``ticker`` is what was asked for and ``resolved_ticker`` is what the market
    calls it now. The two differ when a company has been renamed -- a position
    bought as VVAR3 is quoted as BHIA3 -- and ``renamed`` says so, because a
    reader looking at a page under a code they do not recognise deserves to be
    told why rather than left to wonder if it is the wrong company.
    """

    ticker: str
    resolved_ticker: str | None = None
    renamed: bool = False
    company: StockCompany | None = None
    price_range: StockPriceRange | None = None
    statistics: StockStatistics | None = None
    fundamentals: StockFundamentals | None = None
    cash_dividends: list[StockCashDividend] = field(default_factory=list)
    share_dividends: list[StockShareDividend] = field(default_factory=list)
    subscriptions: list[StockSubscription] = field(default_factory=list)
    #: Each series oldest first, whatever order the provider answered in.
    income_statement: list[StockStatementPoint] = field(default_factory=list)
    balance_sheet: list[StockStatementPoint] = field(default_factory=list)
    cash_flow: list[StockStatementPoint] = field(default_factory=list)
    value_added: list[StockStatementPoint] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            'ticker': self.ticker,
            'resolved_ticker': self.resolved_ticker,
            'renamed': self.renamed,
            'company': _serialize(self.company),
            'price_range': _serialize(self.price_range),
            'statistics': _serialize(self.statistics),
            'fundamentals': _serialize(self.fundamentals),
            'cash_dividends': _serialize(self.cash_dividends),
            'share_dividends': _serialize(self.share_dividends),
            'subscriptions': _serialize(self.subscriptions),
            'income_statement': _serialize(self.income_statement),
            'balance_sheet': _serialize(self.balance_sheet),
            'cash_flow': _serialize(self.cash_flow),
            'value_added': _serialize(self.value_added),
        }
