from app.entrypoints.worker.task_runner import celery_async_task
from app.composition.market_data import (
    build_data_ingestion_service,
    quote_ingestion_runner_context,
    series_ingestion_runner_context,
    usd_brl_ingestion_runner_context,
)


@celery_async_task(name='ingest_quotes_for_held_assets')
async def ingest_quotes_for_held_assets(
    execution_id: int | None = None,
    force_full_history: bool = False,
):
    async with quote_ingestion_runner_context() as service:
        return await service.run(
            execution_id=execution_id,
            force_full_history=force_full_history,
        )


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


@celery_async_task(name='maintain_data_ingestion_history')
async def maintain_data_ingestion_history():
    service = build_data_ingestion_service()
    await service.maintain_history()
