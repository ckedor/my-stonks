from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends

from app.composition.market_data import build_usd_brl_read_service
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.portfolio.service.portfolio_base_service import PortfolioBaseService
from app.modules.portfolio.service.portfolio_category_service import PortfolioCategoryService
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from app.modules.portfolio.service.portfolio_dividend_service import (
    PortfolioDividendService,
)
from app.modules.portfolio.service.portfolio_income_tax_service import (
    PortfolioIncomeTaxService,
)
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)
from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    PortfolioQuoteIngestionService,
)
from app.modules.portfolio.service.portfolio_rebalancing_service import (
    PortfolioRebalancingService,
)
from app.modules.portfolio.service.portfolio_reports_service import PortfolioReportsService
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    PortfolioReturnsConsolidatorService,
)
from app.modules.portfolio.service.portfolio_transaction_service import (
    PortfolioTransactionService,
)
from app.modules.portfolio.service.portfolio_user_configuration import (
    PortfolioUserConfigurationService,
)
from app.modules.portfolio.service.portfolio_wealth_tier_service import (
    PortfolioWealthTierService,
)


def build_portfolio_position_service(uow: UnitOfWork) -> PortfolioPositionService:
    # The market-data reader gets its own UnitOfWork: one instance cannot be
    # entered by both services at the same time.
    return PortfolioPositionService(
        uow=uow,
        market_data_service=MarketDataReadService(
            uow=UnitOfWork(),
            usd_brl=build_usd_brl_read_service(),
            cache=RedisService(),
        ),
        cache=RedisService(),
    )


def get_portfolio_position_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioPositionService:
    return build_portfolio_position_service(uow)


def get_wealth_tier_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioWealthTierService:
    # The tier is read off the patrimony series, so the position service comes
    # in already built: the peak is not a second way of computing patrimony.
    # It gets its own UnitOfWork, since one instance cannot be entered by both
    # services.
    return PortfolioWealthTierService(
        uow=uow,
        position_service=build_portfolio_position_service(UnitOfWork()),
    )


def get_portfolio_service(uow: UnitOfWork = Depends(get_uow)) -> PortfolioBaseService:
    return PortfolioBaseService(uow=uow, cache=RedisService())


def get_portfolio_category_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioCategoryService:
    return PortfolioCategoryService(uow)


def get_portfolio_user_configuration_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioUserConfigurationService:
    return PortfolioUserConfigurationService(uow)


def get_portfolio_rebalancing_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioRebalancingService:
    return PortfolioRebalancingService(uow)


def get_portfolio_dividend_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioDividendService:
    return PortfolioDividendService(uow, usd_brl_service=build_usd_brl_read_service())


def get_portfolio_transaction_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioTransactionService:
    return PortfolioTransactionService(uow, usd_brl_service=build_usd_brl_read_service())


def get_portfolio_income_tax_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioIncomeTaxService:
    return PortfolioIncomeTaxService(uow)


def get_portfolio_reports_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioReportsService:
    return PortfolioReportsService(uow)


def build_portfolio_quote_ingestion_service() -> PortfolioQuoteIngestionService:
    """For task entrypoints, which have no request-scoped UnitOfWork."""
    return PortfolioQuoteIngestionService(UnitOfWork())


def get_portfolio_quote_ingestion_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioQuoteIngestionService:
    return PortfolioQuoteIngestionService(uow)


def get_portfolio_returns_consolidator_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioReturnsConsolidatorService:
    return PortfolioReturnsConsolidatorService(uow)


def get_portfolio_consolidator_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioConsolidatorService:
    return PortfolioConsolidatorService(
        uow=uow,
        provider=MarketDataProvider(),
        usd_brl_service=build_usd_brl_read_service(),
    )


@asynccontextmanager
async def portfolio_consolidator_service_context() -> AsyncIterator[PortfolioConsolidatorService]:
    """Consolidator for tasks and fan-out: one UnitOfWork and provider per run."""
    service = PortfolioConsolidatorService(
        uow=UnitOfWork(),
        provider=MarketDataProvider(),
        usd_brl_service=build_usd_brl_read_service(),
    )
    try:
        yield service
    finally:
        await service.aclose()


def build_portfolio_service_for_task() -> PortfolioBaseService:
    """Portfolio reader for a background run, owning its UnitOfWork.

    A task is an entrypoint: it says what should happen, not how persistence is
    assembled. These three exist so no task has to import UnitOfWork to build
    the service it needs — the same reason the ingestion runners exist on the
    market-data side.
    """
    return PortfolioBaseService(uow=UnitOfWork(), cache=RedisService())


def build_portfolio_position_service_for_task() -> PortfolioPositionService:
    """Position service for a background run, owning its UnitOfWork."""
    return build_portfolio_position_service(UnitOfWork())


def build_portfolio_returns_consolidator_for_task() -> PortfolioReturnsConsolidatorService:
    """Returns consolidator for a background run, owning its UnitOfWork."""
    return PortfolioReturnsConsolidatorService(UnitOfWork())
