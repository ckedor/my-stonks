import asyncio

import nest_asyncio
from celery import shared_task

from app.composition.portfolio import portfolio_consolidator_service_context
from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.entities import Portfolio


@shared_task(name='consolidate_fiis_dividends')
def consolidate_fiis_dividends():
    logger.info('🟢 consolidate_fiis_dividends')

    async def wrapper():
        async with UnitOfWork() as uow:
            portfolios = await uow.portfolios.get_all(Portfolio)
            portfolio_ids = [portfolio.id for portfolio in portfolios]

        async with portfolio_consolidator_service_context() as service:
            for portfolio_id in portfolio_ids:
                await service.consolidate_fii_dividends(portfolio_id)

    try:
        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        loop.run_until_complete(wrapper())
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_fiis_dividends: {e}', exc_info=True)
