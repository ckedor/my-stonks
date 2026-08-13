from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends

from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.brokers_service import BrokersService
from app.modules.market_data.service.fii_service import FIIProfileReadService
from app.modules.market_data.service.market_data_series_ingestion_service import (
    MarketDataSeriesIngestionService,
)
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.market_data.service.quote_ingestion_service import QuoteIngestionService
from app.modules.market_data.service.quote_service import (
    AssetQuoteHistoryService,
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
    QuoteService,
)
from app.modules.market_data.service.usd_brl_ingestion_service import UsdBrlIngestionService
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService


def get_data_ingestion_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> DataIngestionReadService:
    return DataIngestionReadService(uow)


def build_usd_brl_read_service(uow: UnitOfWork | None = None) -> UsdBrlReadService:
    """The cached exchange-rate reader.

    Callers that already hold a `UnitOfWork` pass their own only when they will
    not be inside it; everyone embedding this reader in another service gives it
    a fresh one, since a single instance cannot be entered twice.
    """
    return UsdBrlReadService(uow=uow or UnitOfWork(), cache=RedisService())


def get_market_data_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> MarketDataReadService:
    return MarketDataReadService(
        uow=uow,
        usd_brl=build_usd_brl_read_service(),
        cache=RedisService(),
    )


def get_usd_brl_read_service(uow: UnitOfWork = Depends(get_uow)) -> UsdBrlReadService:
    return build_usd_brl_read_service(uow)


def get_asset_service(uow: UnitOfWork = Depends(get_uow)) -> AssetService:
    return AssetService(uow=uow, cache=RedisService())


def get_broker_service(uow: UnitOfWork = Depends(get_uow)) -> BrokersService:
    return BrokersService(uow)


def get_persisted_quote_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PersistedQuoteReadService:
    return PersistedQuoteReadService(uow)


async def get_on_demand_quote_read_service() -> AsyncIterator[OnDemandQuoteReadService]:
    service = OnDemandQuoteReadService(MarketDataProvider(), cache=RedisService())
    try:
        yield service
    finally:
        await service.aclose()


async def get_asset_quote_history_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[AssetQuoteHistoryService]:
    """Storage-first history for a single asset, with the provider behind it."""
    service = AssetQuoteHistoryService(
        persisted=PersistedQuoteReadService(uow),
        on_demand=OnDemandQuoteReadService(MarketDataProvider(), cache=RedisService()),
        usd_brl=build_usd_brl_read_service(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_fii_profile_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[FIIProfileReadService]:
    """The provider-backed profile of a registered real-estate fund."""
    service = FIIProfileReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


def build_data_ingestion_service() -> DataIngestionService:
    """Ingestion tracking needs one transaction per step, so it takes the factory."""
    return DataIngestionService(uow_factory=UnitOfWork)


def get_data_ingestion_service() -> DataIngestionService:
    return build_data_ingestion_service()


@asynccontextmanager
async def quote_ingestion_runner_context() -> AsyncIterator[QuoteIngestionService]:
    quote_service = QuoteService(
        uow_factory=UnitOfWork,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield QuoteIngestionService(
            ingestion_service=build_data_ingestion_service(),
            quote_service=quote_service,
        )
    finally:
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
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()
