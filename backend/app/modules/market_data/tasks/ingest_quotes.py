"""Celery entrypoint for quote ingestion of an explicit set of assets."""

from app.composition.market_data import quote_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='ingest_quotes')
async def ingest_quotes(
    asset_ids: list[int] | None = None,
    execution_id: int | None = None,
    force_full_history: bool = False,
    selection_parameters: dict | None = None,
):
    """Ingest quotes for ``asset_ids``.

    ``selection_parameters`` is recorded as-is on the execution so the caller
    can explain how it picked the assets.
    """
    async with quote_ingestion_runner_context() as service:
        return await service.run(
            asset_ids=asset_ids,
            execution_id=execution_id,
            force_full_history=force_full_history,
            selection_parameters=selection_parameters,
        )
