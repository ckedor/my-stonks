from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends

from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.asset_catalogue_sync_service import (
    AssetCatalogueSyncService,
)
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.brokers_service import BrokersService
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.market_data.service.fii_service import FIIMarketReadService, FIIProfileReadService
from app.modules.market_data.service.investment_fund_service import (
    InvestmentFundMarketReadService,
    InvestmentFundProfileReadService,
)
from app.modules.market_data.service.market_catalogue_service import MarketCatalogueReadService
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
from app.modules.market_data.service.stock_service import StockProfileReadService
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


async def get_fii_market_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[FIIMarketReadService]:
    """The BRAPI FII universe enriched with registered asset ids."""
    service = FIIMarketReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_investment_fund_profile_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[InvestmentFundProfileReadService]:
    """The provider-backed profile of a registered investment fund."""
    service = InvestmentFundProfileReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_stock_profile_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[StockProfileReadService]:
    """The provider-backed profile of a registered listed company."""
    service = StockProfileReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_investment_fund_market_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[InvestmentFundMarketReadService]:
    """The BRAPI fund universe, minus FIIs and ETFs, with registered asset ids."""
    service = InvestmentFundMarketReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_market_catalogue_read_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[MarketCatalogueReadService]:
    service = MarketCatalogueReadService(
        uow=uow,
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await service.aclose()


async def get_asset_catalogue_sync_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[AssetCatalogueSyncService]:
    """A sincronização e o catálogo que ela lê, cada um com sua UoW.

    Duas porque uma não pode ser aberta duas vezes: a sincronização abre a sua
    para escrever, e o catálogo abriria a mesma para resolver os ids que a tela
    de mercado pede.
    """
    catalogue = MarketCatalogueReadService(
        uow=UnitOfWork(),
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    # Fundo listado vem da rota dedicada, e não do screener: o `type=fund` do
    # screener não traz nome e não distingue FII de FI, que é o que decide o
    # tipo do ativo cadastrado.
    fii_market = FIIMarketReadService(
        uow=UnitOfWork(),
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    investment_fund = InvestmentFundMarketReadService(
        uow=UnitOfWork(),
        provider=MarketDataProvider(),
        cache=RedisService(),
    )
    service = AssetCatalogueSyncService(
        uow=uow,
        catalogue=catalogue,
        fii_market=fii_market,
        investment_fund=investment_fund,
        cache=RedisService(),
    )
    try:
        yield service
    finally:
        await catalogue.aclose()
        await fii_market.aclose()
        await investment_fund.aclose()


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
        cache=RedisService(),
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
