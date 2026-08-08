"""Celery entrypoint for warming the market-data series cache."""

from app.config.logger import logger
from app.composition.market_data import indexes_cache_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='set_indexes_history_cache')
async def set_indexes_history_cache():
    logger.info('Iniciando set_indexes_history_cache')
    async with indexes_cache_runner_context() as service:
        await service.warm_indexes_history()
