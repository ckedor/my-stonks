from dataclasses import dataclass, field
from datetime import date

from app.modules.research.domain.enums import RecommendationChange


@dataclass(frozen=True, kw_only=True)
class SaveRecommendedPositionCommand:
    ticker: str
    asset_id: int | None = None
    name: str | None = None
    weight: float
    rationale: str | None = None
    target_price: float | None = None
    change: RecommendationChange | None = None


@dataclass(frozen=True, kw_only=True)
class SaveRecommendedPortfolioCommand:
    """A reading a person looked at and agreed with.

    `source_name` and not `source_id`: the reader types the house the report
    came from, and whether that is a house already known is a question for the
    slug, not for the screen.
    """

    source_name: str
    title: str
    reference_date: date
    summary: str | None = None
    objective: str | None = None
    positions: list[SaveRecommendedPositionCommand] = field(default_factory=list)
