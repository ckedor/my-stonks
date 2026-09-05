from datetime import date, datetime

from pydantic import BaseModel, Field

from app.modules.research.domain.draft import PositionMatch
from app.modules.research.domain.enums import RecommendationChange


class ResearchSourceResponse(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {'from_attributes': True}


class RecommendedPortfolioTypeResponse(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {'from_attributes': True}


class SaveRecommendedPortfolioTypeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class UpdateRecommendedPortfolioRequest(BaseModel):
    """O que uma carteira já salva aceita mudar depois da importação."""

    type_id: int | None = None


class DraftPositionResponse(BaseModel):
    ticker: str
    name: str | None
    weight: float
    rationale: str | None
    target_price: float | None
    change: RecommendationChange | None
    asset_id: int | None
    asset_name: str | None
    match: PositionMatch

    model_config = {'from_attributes': True}


class RecommendedPortfolioDraftResponse(BaseModel):
    """The reading of one PDF, for the screen that shows it before it is kept."""

    source_name: str | None
    title: str | None
    reference_date: date | None
    summary: str | None
    objective: str | None
    positions: list[DraftPositionResponse]
    total_weight: float
    model: str | None

    model_config = {'from_attributes': True}


class SaveRecommendedPositionRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=30)
    asset_id: int | None = None
    name: str | None = None
    weight: float
    rationale: str | None = None
    target_price: float | None = None
    change: RecommendationChange | None = None


class SaveRecommendedPortfolioRequest(BaseModel):
    source_name: str = Field(min_length=1, max_length=120)
    type_id: int | None = None
    title: str = Field(min_length=1, max_length=200)
    reference_date: date
    summary: str | None = None
    objective: str | None = None
    positions: list[SaveRecommendedPositionRequest]


class RecommendedPositionResponse(BaseModel):
    id: int
    asset_id: int | None
    ticker: str
    name: str | None
    weight: float
    rationale: str | None
    target_price: float | None
    change: RecommendationChange | None

    model_config = {'from_attributes': True}


class RecommendedPortfolioResponse(BaseModel):
    id: int
    source_id: int
    source: ResearchSourceResponse | None
    type_id: int | None
    type: RecommendedPortfolioTypeResponse | None
    title: str
    reference_date: date
    summary: str | None
    objective: str | None
    created_at: datetime | None
    positions: list[RecommendedPositionResponse]

    model_config = {'from_attributes': True}


class RecommendationConsensusEntryResponse(BaseModel):
    asset_id: int
    ticker: str
    name: str
    logo_url: str | None
    houses: int
    portfolios: int
    average_weight: float
    conviction: float
    entered: int
    increased: int
    reduced: int
    source_names: list[str]

    model_config = {'from_attributes': True}


class RecommendationConsensusResponse(BaseModel):
    """O ranking mais o que ficou de fora dele."""

    entries: list[RecommendationConsensusEntryResponse]
    considered_portfolios: int
    considered_sources: int
    unlinked_positions: int
    window_months: int
    oldest_reference_date: date | None
    newest_reference_date: date | None

    model_config = {'from_attributes': True}
