from app.composition.portfolio import (
    build_portfolio_position_service_for_task,
    portfolio_consolidator_service_context,
)
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.portfolio.tasks.consolidate_portfolio_returns import (
    consolidate_portfolio_returns,
)


@celery_async_task(name='recalculate_asset_position')
async def recalculate_position_asset(portfolio_id: int, asset_id: int):
    logger.info(f'🟢 recalculate_position_asset {portfolio_id=}, {asset_id=}')
    try:
        async with portfolio_consolidator_service_context() as service:
            await service.recalculate_position_asset(portfolio_id, asset_id)
        # A posição já commitou, então o patrimônio derivado dela é o que ficou
        # velho. As séries de retorno não: quem as escreve é a task despachada
        # abaixo, e é ela que derruba o cache delas quando terminar.
        position_service = build_portfolio_position_service_for_task()
        await position_service.invalidate_patrimony_evolution(portfolio_id)
        run_task(consolidate_portfolio_returns, portfolio_id)
    except Exception as e:
        logger.error(f'❌ Erro em recalculate_position_asset: {e}', exc_info=True)
