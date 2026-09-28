"""Celery entrypoint for the ETF registry ingestion."""

from app.composition.market_data import etf_registry_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='ingest_etf_registry')
async def ingest_etf_registry(execution_id: int | None = None):
    async with etf_registry_ingestion_runner_context() as service:
        return await service.run(execution_id=execution_id)
