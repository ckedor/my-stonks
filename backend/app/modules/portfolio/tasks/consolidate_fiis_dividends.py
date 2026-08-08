import asyncio

import nest_asyncio
from celery import shared_task

from app.config.logger import logger
from app.composition.portfolio import build_fii_dividend_consolidator_service
from app.infra.db.dependencies import repository_context
from app.modules.portfolio.domain.entities import Portfolio
from app.modules.portfolio.repositories import PortfolioRepository


@shared_task(name='consolidate_fiis_dividends')
def consolidate_fiis_dividends():
    logger.info('🟢 consolidate_fiis_dividends')

    async def wrapper():
        async with repository_context(PortfolioRepository) as repo:
            portfolios = await repo.get_all(Portfolio)
            portfolio_ids = [portfolio.id for portfolio in portfolios]

        service = build_fii_dividend_consolidator_service()
        try:
            for portfolio_id in portfolio_ids:
                await service.consolidate_fii_dividends(portfolio_id)
        finally:
            await service.aclose()

    try:
        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        loop.run_until_complete(wrapper())
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_fiis_dividends: {e}', exc_info=True)
