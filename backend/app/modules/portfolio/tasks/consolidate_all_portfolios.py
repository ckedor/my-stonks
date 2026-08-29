from app.composition.portfolio import build_portfolio_service_for_task
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.portfolio.tasks.consolidate_portfolio import consolidate_portfolio


@celery_async_task(name='consolidate_all_portfolios')
async def consolidate_all_portfolios():
    """Fan out the nightly consolidation, one task per portfolio.

    This task only dispatches. It used to invalidate each portfolio's cached
    reads right here, which ran before the tasks it had just enqueued had even
    started: the cache emptied, the next reader refilled it from the rows the
    consolidation was about to replace, and the stale answer stayed for a whole
    TTL. Each dispatched run now drops what it itself makes stale, and stamps
    when it finished.
    """
    logger.info('🟢 consolidate_all_portfolios')
    try:
        portfolios = await build_portfolio_service_for_task().list_all_portfolios()
        for portfolio in portfolios:
            run_task(consolidate_portfolio, portfolio.id)
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_all_portfolios: {e}', exc_info=True)
