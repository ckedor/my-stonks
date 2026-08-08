from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import Depends

from app.infra.db.dependencies import (
    AssetQuoteRepositories,
    get_asset_quote_repositories,
    get_data_ingestion_repository,
    get_market_data_repository,
    get_repository,
    repository_context,
)
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.unit_of_work import UnitOfWork, get_uow_factory
from app.infra.redis.redis_service import RedisService
from app.entrypoints.worker.data_ingestion_queue import (
    enqueue_data_ingestion,
    enqueue_task,
)
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.repositories.ingestion_repository import DataIngestionRepository
from app.modules.market_data.repositories.market_data_repository import MarketDataRepository
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
    MarketDataIngestionTriggerService,
)
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.brokers_service import BrokersService
from app.modules.market_data.service.market_data_series_ingestion_service import (
    MarketDataSeriesIngestionService,
)
from app.modules.market_data.service.market_data_service import (
    MarketDataCacheService,
    MarketDataReadService,
)
from app.modules.market_data.service.quote_ingestion_service import QuoteIngestionService
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
    QuoteService,
)
from app.modules.market_data.service.usd_brl_ingestion_service import UsdBrlIngestionService
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository
from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    PortfolioQuoteIngestionService,
)


def get_data_ingestion_read_service(
    repository: DataIngestionRepository = Depends(get_data_ingestion_repository),
) -> DataIngestionReadService:
    return DataIngestionReadService(repository)


def get_market_data_read_service(
    repository: MarketDataRepository = Depends(get_market_data_repository),
) -> MarketDataReadService:
    return MarketDataReadService(repository=repository)


def get_usd_brl_read_service(
    repository: MarketDataRepository = Depends(get_market_data_repository),
) -> UsdBrlReadService:
    return UsdBrlReadService(repository)


def get_asset_read_service(
    repository: SQLAlchemyRepository = Depends(get_repository),
) -> AssetService:
    return AssetService(repository=repository, cache=RedisService())


def get_asset_write_service(
    uow_factory: Callable[[], UnitOfWork] = Depends(get_uow_factory),
) -> AssetService:
    return AssetService(uow=uow_factory(), cache=RedisService())


def get_broker_read_service(
    repository: SQLAlchemyRepository = Depends(get_repository),
) -> BrokersService:
    return BrokersService(repository=repository)


def get_broker_write_service(
    uow_factory: Callable[[], UnitOfWork] = Depends(get_uow_factory),
) -> BrokersService:
    return BrokersService(uow=uow_factory())


def get_persisted_quote_read_service(
    repositories: AssetQuoteRepositories = Depends(get_asset_quote_repositories),
) -> PersistedQuoteReadService:
    return PersistedQuoteReadService(
        asset_repository=repositories.assets,
        quote_repository=repositories.quotes,
    )


async def get_on_demand_quote_read_service() -> AsyncIterator[OnDemandQuoteReadService]:
    service = OnDemandQuoteReadService(MarketDataProvider())
    try:
        yield service
    finally:
        await service.aclose()


def build_data_ingestion_service(
    *,
    uow_factory: Callable[[], UnitOfWork] = UnitOfWork,
) -> DataIngestionService:
    return DataIngestionService(
        uow_factory=uow_factory,
        enqueue_ingestion=enqueue_data_ingestion,
    )


def get_data_ingestion_service(
    uow_factory: Callable[[], UnitOfWork] = Depends(get_uow_factory),
) -> DataIngestionService:
    return build_data_ingestion_service(uow_factory=uow_factory)


def get_market_data_ingestion_trigger_service() -> MarketDataIngestionTriggerService:
    return MarketDataIngestionTriggerService(
        enqueue_series=lambda: enqueue_task('ingest_market_data_series'),
        enqueue_usd_brl=lambda: enqueue_task('ingest_usd_brl'),
    )


@asynccontextmanager
async def quote_ingestion_runner_context() -> AsyncIterator[QuoteIngestionService]:
    async with repository_context(PortfolioRepository) as repository:
        quote_service = QuoteService(
            uow_factory=UnitOfWork,
            provider=MarketDataProvider(),
            cache=RedisService(),
        )
        tracker = build_data_ingestion_service()
        yield QuoteIngestionService(
            ingestion_service=tracker,
            quote_service=quote_service,
            portfolio_service=PortfolioQuoteIngestionService(repository),
        )
        await quote_service.aclose()


@asynccontextmanager
async def series_ingestion_runner_context() -> AsyncIterator[MarketDataSeriesIngestionService]:
    service = MarketDataSeriesIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=build_data_ingestion_service(),
        provider=MarketDataProvider(),
    )
    try:
        yield service
    finally:
        await service.aclose()


@asynccontextmanager
async def usd_brl_ingestion_runner_context() -> AsyncIterator[UsdBrlIngestionService]:
    service = UsdBrlIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=build_data_ingestion_service(),
        provider=MarketDataProvider(),
    )
    try:
        yield service
    finally:
        await service.aclose()


@asynccontextmanager
async def indexes_cache_runner_context() -> AsyncIterator[MarketDataCacheService]:
    async with repository_context(MarketDataRepository) as repository:
        read_service = MarketDataReadService(
            repository=repository,
            cache=RedisService(),
        )
        yield MarketDataCacheService(
            read_service=read_service,
            cache=RedisService(),
        )
