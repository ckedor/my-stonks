"""Celery entrypoint for USD/BRL exchange-rate ingestion."""

from app.composition.market_data import usd_brl_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='ingest_usd_brl')
async def ingest_usd_brl(
    execution_id: int | None = None,
    force_full_history: bool = False,
):
    async with usd_brl_ingestion_runner_context() as service:
        return await service.run(
            execution_id=execution_id,
            force_full_history=force_full_history,
        )
