"""Celery entrypoint for market-data series ingestion."""

from app.composition.market_data import series_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='ingest_market_data_series')
async def ingest_market_data_series(
    execution_id: int | None = None,
    force_full_history: bool = False,
):
    async with series_ingestion_runner_context() as service:
        return await service.run(
            execution_id=execution_id,
            force_full_history=force_full_history,
        )
