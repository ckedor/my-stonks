from fastapi import Depends

from app.infra.db.dependencies import get_portfolio_repository
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository
from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    PortfolioQuoteIngestionService,
)


def get_portfolio_quote_ingestion_service(
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> PortfolioQuoteIngestionService:
    return PortfolioQuoteIngestionService(repository)

