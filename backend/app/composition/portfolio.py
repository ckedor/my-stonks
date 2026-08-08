from fastapi import Depends

from app.infra.db.dependencies import (
    PortfolioMarketDataRepositories,
    get_portfolio_market_data_repositories,
    get_portfolio_repository,
)
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from app.modules.portfolio.service.portfolio_dividend_service import (
    PortfolioDividendService,
)
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)
from app.modules.portfolio.service.portfolio_transaction_service import (
    PortfolioTransactionService,
)


def build_portfolio_consolidator_service(
    *,
    uow: UnitOfWork | None = None,
    repository: PortfolioRepository | None = None,
    market_data_service: MarketDataReadService | None = None,
) -> PortfolioConsolidatorService:
    return PortfolioConsolidatorService(
        uow=uow,
        repository=repository,
        market_data_service=market_data_service or MarketDataReadService(),
    )


def build_fii_dividend_consolidator_service() -> PortfolioConsolidatorService:
    market_data_service = MarketDataReadService(provider=MarketDataProvider())
    return build_portfolio_consolidator_service(
        uow=UnitOfWork(),
        market_data_service=market_data_service,
    )


def build_portfolio_consolidator_write_service() -> PortfolioConsolidatorService:
    return build_portfolio_consolidator_service(uow=UnitOfWork())


def build_portfolio_position_service(
    repositories: PortfolioMarketDataRepositories,
) -> PortfolioPositionService:
    market_data_service = MarketDataReadService(repository=repositories.market_data)
    return PortfolioPositionService(
        repository=repositories.portfolios,
        market_data_service=market_data_service,
    )


def get_portfolio_position_service(
    repositories: PortfolioMarketDataRepositories = Depends(get_portfolio_market_data_repositories),
) -> PortfolioPositionService:
    return build_portfolio_position_service(repositories)


def get_portfolio_consolidator_read_service(
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> PortfolioConsolidatorService:
    return build_portfolio_consolidator_service(repository=repository)


def get_portfolio_consolidator_write_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioConsolidatorService:
    return build_portfolio_consolidator_service(uow=uow)


def get_portfolio_dividend_read_service(
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> PortfolioDividendService:
    return PortfolioDividendService(
        repository=repository,
        market_data_service=MarketDataReadService(),
    )


def get_portfolio_dividend_write_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioDividendService:
    return PortfolioDividendService(
        uow=uow,
        market_data_service=MarketDataReadService(),
    )


def get_portfolio_transaction_read_service(
    repository: PortfolioRepository = Depends(get_portfolio_repository),
) -> PortfolioTransactionService:
    return PortfolioTransactionService(
        repository=repository,
        market_data_service=MarketDataReadService(),
    )


def get_portfolio_transaction_write_service(
    uow: UnitOfWork = Depends(get_uow),
) -> PortfolioTransactionService:
    return PortfolioTransactionService(
        uow=uow,
        market_data_service=MarketDataReadService(),
    )
