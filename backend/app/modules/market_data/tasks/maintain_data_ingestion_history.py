"""Celery entrypoint for data-ingestion history maintenance."""

from app.composition.market_data import build_data_ingestion_service
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='maintain_data_ingestion_history')
async def maintain_data_ingestion_history():
    service = build_data_ingestion_service()
    await service.maintain_history()
