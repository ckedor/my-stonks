"""Scheduled entrypoint that turns held ETFs into a holdings ingestion.

Which ETFs are held is portfolio knowledge, so it is decided here, with the
same recent-position window the quotes use. Market data only learns the ids:
this task chains into ``ingest_etf_holdings``.
"""

from app.composition.portfolio import build_portfolio_quote_ingestion_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.tasks.ingest_etf_holdings import ingest_etf_holdings


@celery_async_task(name='ingest_etf_holdings_for_held_etfs')
async def ingest_etf_holdings_for_held_etfs(execution_id: int | None = None):
    service = build_portfolio_quote_ingestion_service()
    selection = await service.get_assets_requiring_quote_ingestion(
        full_history=False, asset_type_ids=[int(ASSET_TYPE.ETF)]
    )
    logger.info(
        '🟢 ingest_etf_holdings_for_held_etfs selecionou %s ETFs (%s)',
        len(selection.asset_ids),
        selection.description,
    )
    run_task(
        ingest_etf_holdings,
        asset_ids=selection.asset_ids,
        execution_id=execution_id,
        selection_parameters={'selection': selection.description},
    )
    return execution_id
