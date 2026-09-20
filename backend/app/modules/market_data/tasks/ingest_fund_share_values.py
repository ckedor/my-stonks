"""Celery entrypoint for share values of funds priced from regulator filings."""

from datetime import date

from app.composition.market_data import fund_share_value_ingestion_runner_context
from app.entrypoints.worker.task_runner import celery_async_task, run_task_by_name

#: Owned by the portfolio module, and dispatched by name: market data does not
#: know which portfolios hold an asset, only that its history changed.
RECALCULATE_POSITIONS_FOR_ASSETS_TASK = 'recalculate_positions_for_assets'


@celery_async_task(name='ingest_fund_share_values')
async def ingest_fund_share_values(
    fund_asset_ids_since: dict[str, str] | None = None,
    without_purchase: list[int] | None = None,
    execution_id: int | None = None,
    force_full_history: bool = False,
    selection_parameters: dict | None = None,
):
    """Ingest share values for ``{asset_id: first purchase date}``.

    After committed changes the affected positions are rebuilt in full, because
    a correction can predate the window routine consolidation recalculates.
    """
    since = {
        int(asset_id): date.fromisoformat(value)
        for asset_id, value in (fund_asset_ids_since or {}).items()
    }
    async with fund_share_value_ingestion_runner_context() as service:
        run = await service.run(
            fund_asset_ids_since=since,
            without_purchase=without_purchase or [],
            execution_id=execution_id,
            force_full_history=force_full_history,
            selection_parameters=selection_parameters,
        )
    if run.changed:
        run_task_by_name(RECALCULATE_POSITIONS_FOR_ASSETS_TASK, sorted(run.changed))
    return run.execution_id
