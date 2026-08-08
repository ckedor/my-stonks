"""Celery queue adapter used by the application composition root."""

from app.entrypoints.worker.celery_app import celery_app
from app.modules.market_data.domain.ingestion import DataIngestionType

TASK_BY_INGESTION_TYPE = {
    DataIngestionType.QUOTE: 'ingest_quotes_for_held_assets',
    DataIngestionType.MARKET_DATA_SERIES: 'ingest_market_data_series',
    DataIngestionType.USD_BRL: 'ingest_usd_brl',
}


def enqueue_data_ingestion(
    ingestion_type: DataIngestionType,
    execution_id: int,
    force_full_history: bool,
) -> str:
    result = celery_app.send_task(
        TASK_BY_INGESTION_TYPE[ingestion_type],
        args=[execution_id, force_full_history],
    )
    return result.id


def enqueue_task(task_name: str) -> None:
    celery_app.send_task(task_name)
