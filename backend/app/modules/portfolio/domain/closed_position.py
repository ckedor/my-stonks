from dataclasses import dataclass
from datetime import date as date_type


@dataclass(frozen=True, kw_only=True)
class ClosedPosition:
    """An asset the portfolio held and no longer holds.

    Two readings live here, and they answer different questions. The realized
    numbers — what was sold for, against what it cost — say how much money the
    round trip made. The accumulated return and the CAGR are the same
    time-weighted series every other screen reads, frozen on the last day of
    exposure: they say how the asset performed while it was held, dividends
    included and contributions excluded.

    Keeping both is deliberate. Profit alone hides that a large position held
    briefly can beat a small one held for years, and return alone hides how
    much money the decision actually moved.
    """

    asset_id: int
    ticker: str | None
    name: str
    type: str
    category: str | None
    #: First and last trade of the round trip. `exit_date` is the last sale,
    #: which is the day the position stopped existing.
    entry_date: date_type
    exit_date: date_type
    days_held: int
    quantity_sold: float
    #: Average cost carried into the exit, and the average price it left at.
    average_price: float
    average_sale_price: float
    #: What the purchases cost and what the sales brought in.
    total_invested: float
    gross_sales: float
    realized_profit: float
    #: Realized profit over the cost of what was sold. `None` when there is no
    #: cost to divide by — a position received rather than bought.
    realized_profit_pct: float | None
    dividends: float
    #: Time-weighted return on the last day the position existed.
    acc_return: float | None
    cagr: float | None
