from app.composition.portfolio import build_portfolio_position_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.tasks.consolidate_portfolio_returns import (
    consolidate_portfolio_returns,
)
from app.modules.portfolio.tasks.consolidate_single_portfolio import (
    consolidate_single_portfolio,
)


@celery_async_task(name='consolidate_all_portfolios')
async def consolidate_all_portfolios():
    from app.modules.portfolio.domain.entities import Portfolio

    logger.info('🟢 consolidate_all_portfolios')
    try:
        async with UnitOfWork() as uow:
            portfolios = await uow.portfolios.get_all(Portfolio)
            portfolio_ids = [portfolio.id for portfolio in portfolios]

        position_service = build_portfolio_position_service(UnitOfWork())
        for portfolio_id in portfolio_ids:
            run_task(consolidate_single_portfolio, portfolio_id)
            run_task(consolidate_portfolio_returns, portfolio_id)
            await position_service.invalidate_cached_analytics(portfolio_id)
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_all_portfolios: {e}', exc_info=True)
