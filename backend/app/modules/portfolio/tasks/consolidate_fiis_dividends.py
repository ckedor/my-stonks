"""Record the payments each portfolio's real-estate funds made.

One `UnitOfWork` per portfolio, and the same `celery_async_task` every other
task uses. It was the only one on `@shared_task` with `nest_asyncio` patching
the loop the worker already owns, and the only one holding a single session
open across every portfolio -- so one portfolio failing took the rest with it.
"""

from app.composition.portfolio import (
    build_portfolio_service_for_task,
    portfolio_consolidator_service_context,
)
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='consolidate_fiis_dividends')
async def consolidate_fiis_dividends():
    logger.info('🟢 consolidate_fiis_dividends')
    try:
        portfolios = await build_portfolio_service_for_task().list_all_portfolios()
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_fiis_dividends: {e}', exc_info=True)
        return

    for portfolio in portfolios:
        try:
            async with portfolio_consolidator_service_context() as service:
                await service.consolidate_fii_dividends(portfolio.id)
        except Exception as e:
            # A falha de uma carteira não é a das outras: o provedor pode não
            # conhecer um fundo, e as demais continuam.
            logger.error(
                f'❌ Falha ao consolidar proventos de FII do portfolio {portfolio.id}: {e}',
                exc_info=True,
            )
