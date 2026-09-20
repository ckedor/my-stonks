"""Rebuild every position of assets whose price history changed."""

from app.composition.portfolio import build_portfolio_quote_ingestion_service
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task, run_task
from app.modules.portfolio.tasks.recalculate_asset_position import recalculate_position_asset


@celery_async_task(name='recalculate_positions_for_assets')
async def recalculate_positions_for_assets(asset_ids: list[int]):
    service = build_portfolio_quote_ingestion_service()
    pairs = await service.get_positions_to_recalculate(asset_ids)
    logger.info('🟢 recalculate_positions_for_assets: %s posições', len(pairs))
    for portfolio_id, asset_id in pairs:
        run_task(recalculate_position_asset, portfolio_id, asset_id, ingest_share_values=False)
