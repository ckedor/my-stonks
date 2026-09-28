"""Celery entrypoint for the ETF holdings ingestion."""

from app.composition.market_data import etf_holdings_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='ingest_etf_holdings')
async def ingest_etf_holdings(
    asset_ids: list[int] | None = None,
    execution_id: int | None = None,
    selection_parameters: dict | None = None,
):
    async with etf_holdings_ingestion_runner_context() as service:
        return await service.run(
            asset_ids=asset_ids,
            execution_id=execution_id,
            selection_parameters=selection_parameters,
        )
