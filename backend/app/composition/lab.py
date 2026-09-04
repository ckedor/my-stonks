from collections.abc import AsyncIterator

from fastapi import Depends

from app.composition.market_data import build_usd_brl_read_service
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.redis.redis_service import RedisService
from app.modules.lab.service.backtest_service import BacktestService
from app.modules.lab.service.theoretical_portfolio_service import TheoreticalPortfolioService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)


def get_theoretical_portfolio_service(
    uow: UnitOfWork = Depends(get_uow),
) -> TheoreticalPortfolioService:
    return TheoreticalPortfolioService(uow)


async def get_backtest_service(
    uow: UnitOfWork = Depends(get_uow),
) -> AsyncIterator[BacktestService]:
    """A simulação, com as leituras de mercado que ela precisa.

    Cada colaborador que fala com o banco recebe o **seu** `UnitOfWork`: uma
    instância não pode ser entrada duas vezes, e a simulação lê cotação e série
    dentro do mesmo pedido. É o mesmo arranjo de
    `build_portfolio_position_service`.

    O provedor entra porque um ativo que ninguém ingeriu ainda tem de poder ser
    simulado — daí o `aclose` no `finally`, como em
    `get_asset_quote_history_service`.
    """
    service = BacktestService(
        persisted_quotes=PersistedQuoteReadService(uow),
        on_demand_quotes=OnDemandQuoteReadService(MarketDataProvider(), cache=RedisService()),
        market_data=MarketDataReadService(
            uow=UnitOfWork(),
            usd_brl=build_usd_brl_read_service(),
            cache=RedisService(),
        ),
        usd_brl=build_usd_brl_read_service(),
    )
    try:
        yield service
    finally:
        await service.aclose()
