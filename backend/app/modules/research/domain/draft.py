from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.modules.research.domain.enums import RecommendationChange


class PositionMatch(StrEnum):
    """Whether the ticker a report names is one the catalogue carries.

    Three answers and not two: a ticker registered twice — the same code under
    two asset types — is not the same problem as one that is missing, and the
    screen resolves them differently. Guessing between two candidates here
    would link a recommendation to the wrong asset without saying so.
    """

    MATCHED = 'matched'
    UNKNOWN = 'unknown'
    AMBIGUOUS = 'ambiguous'


@dataclass(frozen=True, kw_only=True)
class DraftPosition:
    ticker: str
    name: str | None
    weight: float
    rationale: str | None
    target_price: float | None
    change: RecommendationChange | None
    asset_id: int | None
    asset_name: str | None
    match: PositionMatch


@dataclass(frozen=True, kw_only=True)
class RecommendedPortfolioDraft:
    """What one PDF turned into, before anybody agreed with it.

    It is not persisted. The reading only becomes a recommended portfolio once
    a person has looked at it and posted it back, so nothing in the database
    ever holds a weight no one confirmed.
    """

    source_name: str | None
    title: str | None
    reference_date: date | None
    summary: str | None
    objective: str | None
    positions: list[DraftPosition]
    #: The weights as they were read, summed. Not a rule, a fact: a report
    #: whose lines add up to 97% is either an extraction that missed a line or
    #: a portfolio holding cash, and only the reader can tell which.
    total_weight: float
    model: str | None
