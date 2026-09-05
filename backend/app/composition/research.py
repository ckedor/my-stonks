from fastapi import Depends

from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.openai.openai_client import get_ai_provider
from app.modules.ai.domain.provider import AIProvider
from app.modules.research.adapters.recommended_portfolio_extractor import (
    RecommendedPortfolioExtractor,
)
from app.modules.research.service.recommendation_consensus_service import (
    RecommendationConsensusService,
)
from app.modules.research.service.recommended_portfolio_extraction_service import (
    RecommendedPortfolioExtractionService,
)
from app.modules.research.service.recommended_portfolio_service import (
    RecommendedPortfolioService,
)


def get_recommended_portfolio_service(
    uow: UnitOfWork = Depends(get_uow),
) -> RecommendedPortfolioService:
    return RecommendedPortfolioService(uow)


def get_recommended_portfolio_extraction_service(
    uow: UnitOfWork = Depends(get_uow),
    provider: AIProvider = Depends(get_ai_provider),
) -> RecommendedPortfolioExtractionService:
    return RecommendedPortfolioExtractionService(
        uow=uow,
        extractor=RecommendedPortfolioExtractor(provider),
    )


def get_recommendation_consensus_service(
    uow: UnitOfWork = Depends(get_uow),
) -> RecommendationConsensusService:
    return RecommendationConsensusService(uow)
