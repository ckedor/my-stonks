from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import TypeVar

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.session import AsyncSessionLocal
from app.modules.market_data.repositories.market_data_repository import MarketDataRepository
from app.modules.market_data.repositories.ingestion_repository import DataIngestionRepository
from app.modules.market_data.repositories.asset_repository import AssetRepository
from app.modules.market_data.repositories.quote_repository import QuoteRepository
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository

RepositoryType = TypeVar('RepositoryType', bound=SQLAlchemyRepository)


@dataclass(frozen=True)
class PortfolioMarketDataRepositories:
    portfolios: PortfolioRepository
    market_data: MarketDataRepository


@dataclass(frozen=True)
class AssetQuoteRepositories:
    assets: AssetRepository
    quotes: QuoteRepository


@asynccontextmanager
async def repository_context(
    repository_type: type[RepositoryType],
) -> AsyncIterator[RepositoryType]:
    """Create a read repository while keeping its session infrastructure-private."""
    async with AsyncSessionLocal() as session:
        yield repository_type(session)


async def get_repository() -> AsyncIterator[SQLAlchemyRepository]:
    async with repository_context(SQLAlchemyRepository) as repository:
        yield repository


async def get_market_data_repository() -> AsyncIterator[MarketDataRepository]:
    async with repository_context(MarketDataRepository) as repository:
        yield repository


async def get_quote_repository() -> AsyncIterator[QuoteRepository]:
    async with repository_context(QuoteRepository) as repository:
        yield repository


async def get_asset_quote_repositories() -> AsyncIterator[AssetQuoteRepositories]:
    async with AsyncSessionLocal() as session:
        yield AssetQuoteRepositories(
            assets=AssetRepository(session),
            quotes=QuoteRepository(session),
        )


async def get_data_ingestion_repository() -> AsyncIterator[DataIngestionRepository]:
    async with repository_context(DataIngestionRepository) as repository:
        yield repository


async def get_portfolio_repository() -> AsyncIterator[PortfolioRepository]:
    async with repository_context(PortfolioRepository) as repository:
        yield repository


async def get_portfolio_market_data_repositories() -> AsyncIterator[
    PortfolioMarketDataRepositories
]:
    """Share one read session for the portfolio analyses that query both repositories."""
    async with portfolio_market_data_repository_context() as repositories:
        yield repositories


@asynccontextmanager
async def portfolio_market_data_repository_context() -> AsyncIterator[
    PortfolioMarketDataRepositories
]:
    async with AsyncSessionLocal() as session:
        yield PortfolioMarketDataRepositories(
            portfolios=PortfolioRepository(session),
            market_data=MarketDataRepository(session),
        )
