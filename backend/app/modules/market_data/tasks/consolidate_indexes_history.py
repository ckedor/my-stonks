"""Compatibility task that delegates to the two independent ingestions."""

from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.market_data.tasks.ingest_market_data import (
    ingest_market_data_series,
    ingest_usd_brl,
)


@celery_async_task(name='consolidate_indexes_history')
async def consolidate_indexes_history():
    run_task(ingest_market_data_series)
    run_task(ingest_usd_brl)
