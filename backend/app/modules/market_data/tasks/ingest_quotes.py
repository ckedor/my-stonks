"""Compatibility exports for the former quote-only task module."""

from app.modules.market_data.domain.ingestion import DataIngestionType
from app.entrypoints.worker.data_ingestion_queue import enqueue_data_ingestion
from app.modules.market_data.tasks.ingest_market_data import ingest_quotes_for_held_assets


def enqueue_quote_ingestion(execution_id: int, force_full_history: bool) -> str:
    return enqueue_data_ingestion(
        DataIngestionType.QUOTE,
        execution_id,
        force_full_history,
    )


__all__ = ['enqueue_quote_ingestion', 'ingest_quotes_for_held_assets']
