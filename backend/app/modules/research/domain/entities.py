from dataclasses import dataclass, field
from datetime import date, datetime

from app.modules.research.domain.enums import RecommendationChange


@dataclass(eq=False, kw_only=True)
class ResearchSource:
    """The house that publishes a recommendation: BTG Pactual, XP Research.

    It is a row and not a column on the recommendation because the name is
    typed by hand on every upload, and "BTG" and "BTG Pactual" written on two
    different days would otherwise become two houses with half a history each.
    The slug is what makes them the same one.
    """

    id: int | None = None
    name: str
    slug: str
    created_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class RecommendedPortfolioType:
    """What kind of carteira an edition is: FII, ETF global, ações Brasil.

    A row and not an enum in code because the list is the maintainer's to
    extend: a house publishing a new kind of carteira is a cadastro on the
    admin screen, not a migration. The slug is what keeps "ETF Global" and
    "etf global" the same type.
    """

    id: int | None = None
    name: str
    slug: str
    created_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class RecommendedPortfolio:
    """One published edition of a recommended portfolio.

    `reference_date` is the month the report speaks for, not the day it was
    read: a house republishes the same portfolio every month, and the editions
    are told apart by the period they refer to. It is also the date any later
    measurement of how the recommendation fared has to start from, which is why
    it is stored rather than derived from the upload.
    """

    id: int | None = None
    source_id: int
    type_id: int | None = None
    title: str
    reference_date: date
    summary: str | None = None
    objective: str | None = None
    created_at: datetime | None = None
    source: ResearchSource | None = None
    type: RecommendedPortfolioType | None = None
    positions: list['RecommendedPosition'] = field(default_factory=list)


@dataclass(eq=False, kw_only=True)
class RecommendedPosition:
    """One line of a recommended portfolio: an asset and the weight it is given.

    `asset_id` is nullable on purpose. A report names tickers, and a ticker the
    catalogue does not carry is still part of the recommendation — dropping the
    line would silently change the weights of the ones that stayed. An unlinked
    line keeps its ticker and waits for the asset to be registered.
    """

    id: int | None = None
    recommended_portfolio_id: int | None = None
    asset_id: int | None = None
    ticker: str
    name: str | None = None
    weight: float
    rationale: str | None = None
    target_price: float | None = None
    change: RecommendationChange | None = None
