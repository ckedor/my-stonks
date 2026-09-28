"""Scheduled entrypoint that keeps the reference ETFs priced.

The held-assets selection only prices what a portfolio owns; the market screens
also read the reference ETFs, held or not. Same chain as that task: select the
ids here, and let ``ingest_quotes`` do the ingestion.
"""

from app.composition.market_data import build_market_reading_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.market_data.tasks.ingest_quotes import ingest_quotes


@celery_async_task(name='ingest_quotes_for_reference_etfs')
async def ingest_quotes_for_reference_etfs(
    execution_id: int | None = None,
    force_full_history: bool = False,
):
    service = build_market_reading_service()
    selection = await service.get_reference_etf_selection()
    logger.info(
        '🟢 ingest_quotes_for_reference_etfs: %s com cotação, %s sem nenhuma',
        len(selection.priced),
        len(selection.unpriced),
    )
    if force_full_history:
        runs = [(selection.priced + selection.unpriced, True)]
    else:
        # Quem ainda não tem cotação pede o histórico inteiro uma vez; o
        # incremental pediria só a última semana.
        runs = [(selection.priced, False), (selection.unpriced, True)]
    for asset_ids, full_history in runs:
        if not asset_ids:
            continue
        run_task(
            ingest_quotes,
            asset_ids=asset_ids,
            execution_id=execution_id,
            force_full_history=full_history,
            selection_parameters={'selection': 'reference ETFs', 'full_history': full_history},
        )
    return execution_id
