from app.config.logger import logger
from app.composition.portfolio import build_portfolio_consolidator_write_service
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.portfolio.tasks.consolidate_portfolio_returns import (
    consolidate_portfolio_returns,
)
from app.modules.portfolio.tasks.set_patrimony_evolution_cache import (
    set_patrimony_evolution_cache,
)
from app.modules.portfolio.tasks.set_portfolio_returns_cache import (
    set_portfolio_returns_cache,
)


@celery_async_task(name='recalculate_asset_position')
async def recalculate_position_asset(portfolio_id: int, asset_id: int):
    logger.info(f'🟢 recalculate_position_asset {portfolio_id=}, {asset_id=}')
    try:
        service = build_portfolio_consolidator_write_service()
        try:
            await service.recalculate_position_asset(portfolio_id, asset_id)
            run_task(set_patrimony_evolution_cache, portfolio_id)
            run_task(set_portfolio_returns_cache, portfolio_id)
            run_task(consolidate_portfolio_returns, portfolio_id)
        finally:
            await service.aclose()
    except Exception as e:
        logger.error(f'❌ Erro em recalculate_position_asset: {e}', exc_info=True)
