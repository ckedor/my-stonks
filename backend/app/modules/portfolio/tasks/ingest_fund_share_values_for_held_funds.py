"""Scheduled entrypoint that turns fund purchases into a share-value ingestion.

Which funds, and since when, is portfolio knowledge, so it is decided here.
Market data only learns the resulting dates: this task chains into
``ingest_fund_share_values``, as ``ingest_quotes_for_held_assets`` does for quotes.
"""

from app.composition.portfolio import build_portfolio_quote_ingestion_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.tasks.ingest_fund_share_values import ingest_fund_share_values

FUND_ASSET_TYPES = [int(ASSET_TYPE.FI), int(ASSET_TYPE.PREV)]


@celery_async_task(name='ingest_fund_share_values_for_held_funds')
async def ingest_fund_share_values_for_held_funds(
    execution_id: int | None = None,
    force_full_history: bool = False,
    item_ids: list[int] | None = None,
):
    service = build_portfolio_quote_ingestion_service()
    selection = await service.get_funds_requiring_share_values(
        full_history=force_full_history,
        asset_type_ids=FUND_ASSET_TYPES,
        item_ids=item_ids,
    )
    logger.info(
        '🟢 ingest_fund_share_values_for_held_funds selecionou %s fundos (%s)',
        len(selection.since),
        selection.description,
    )
    run_task(
        ingest_fund_share_values,
        fund_asset_ids_since={
            str(asset_id): since.isoformat() for asset_id, since in selection.since.items()
        },
        without_purchase=selection.without_purchase,
        execution_id=execution_id,
        force_full_history=force_full_history,
        selection_parameters={'selection': selection.description},
    )
    return execution_id
