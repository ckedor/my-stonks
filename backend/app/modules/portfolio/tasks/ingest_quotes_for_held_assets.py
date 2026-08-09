"""Scheduled entrypoint that turns held positions into a quote ingestion.

Selecting assets is portfolio knowledge, so it happens here. Market data only
learns the resulting ids: this task chains into ``ingest_quotes``.
"""

from app.composition.portfolio import build_portfolio_quote_ingestion_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.market_data.domain.constants import SUPPORTED_QUOTE_ASSET_TYPES
from app.modules.market_data.tasks.ingest_quotes import ingest_quotes


@celery_async_task(name='ingest_quotes_for_held_assets')
async def ingest_quotes_for_held_assets(
    execution_id: int | None = None,
    force_full_history: bool = False,
):
    service = build_portfolio_quote_ingestion_service()
    selection = await service.get_assets_requiring_quote_ingestion(
        full_history=force_full_history,
        asset_type_ids=[int(value) for value in SUPPORTED_QUOTE_ASSET_TYPES],
    )
    logger.info(
        '🟢 ingest_quotes_for_held_assets selecionou %s ativos (%s)',
        len(selection.asset_ids),
        selection.description,
    )
    run_task(
        ingest_quotes,
        asset_ids=selection.asset_ids,
        execution_id=execution_id,
        force_full_history=force_full_history,
        selection_parameters={
            'selection': selection.description,
            'position_window_days': selection.position_window_days,
            'position_reference_date': (
                selection.position_reference_date.isoformat()
                if selection.position_reference_date is not None
                else None
            ),
        },
    )
    return execution_id
