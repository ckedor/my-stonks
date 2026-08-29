from app.composition.portfolio import build_portfolio_returns_consolidator_for_task
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    CONSOLIDATION_FAILURE,
)


@celery_async_task(name='consolidate_portfolio_returns')
async def consolidate_portfolio_returns(portfolio_id: int):
    """Rebuild the return series alone, after a single asset was recalculated.

    The full consolidation is `consolidate_portfolio`; this is the cheaper half,
    for when only one position changed. It stamps too: the return series are the
    last thing rebuilt either way.
    """
    logger.info(f'🟢 consolidate_portfolio_returns para {portfolio_id}')
    service = build_portfolio_returns_consolidator_for_task()
    try:
        await service.consolidate_returns(portfolio_id)
        await service.mark_consolidated(portfolio_id)
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_portfolio_returns: {e}', exc_info=True)
        try:
            await service.mark_consolidated(
                portfolio_id,
                status=CONSOLIDATION_FAILURE,
                error=str(e) or e.__class__.__name__,
            )
        except Exception:
            logger.exception('Falha ao registrar o carimbo de consolidação')
