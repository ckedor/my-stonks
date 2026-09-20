from app.composition.market_data import fund_share_value_ingestion_runner_context
from app.composition.portfolio import (
    build_portfolio_position_service_for_task,
    build_portfolio_quote_ingestion_service,
    portfolio_consolidator_service_context,
)
from app.config.logger import logger
from app.core.exceptions import BusinessRuleError
from app.entrypoints.worker.task_runner import celery_async_task, run_task, run_task_by_name
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.portfolio.tasks.consolidate_portfolio_returns import (
    consolidate_portfolio_returns,
)


@celery_async_task(name='recalculate_asset_position')
async def recalculate_position_asset(
    portfolio_id: int, asset_id: int, *, ingest_share_values: bool = True
):
    logger.info(f'🟢 recalculate_position_asset {portfolio_id=}, {asset_id=}')
    # A first purchase has no prices yet. Ingest before reading persisted quotes;
    # the consolidator remains a read-only consumer of price history.
    if ingest_share_values:
        selection_service = build_portfolio_quote_ingestion_service()
        selection = await selection_service.get_funds_requiring_share_values(
            full_history=False,
            asset_type_ids=[int(ASSET_TYPE.FI), int(ASSET_TYPE.PREV)],
            item_ids=[asset_id],
        )
        if selection.since:
            async with fund_share_value_ingestion_runner_context() as ingestion:
                result = await ingestion.run(fund_asset_ids_since=selection.since)
            # Quotes are shared by portfolios. Corrections also rebuild the
            # other holders, without recursively importing those quotes again.
            if result.changed:
                pairs = await selection_service.get_positions_to_recalculate(sorted(result.changed))
                for other_portfolio, other_asset in pairs:
                    if (other_portfolio, other_asset) != (portfolio_id, asset_id):
                        run_task_by_name(
                            'recalculate_asset_position',
                            other_portfolio,
                            other_asset,
                            ingest_share_values=False,
                        )
            if asset_id not in result.succeeded:
                reason = result.errors.get(asset_id, 'Ingestion did not complete')
                raise BusinessRuleError(
                    f'Cannot consolidate asset {asset_id}: {reason}',
                    context={'asset_id': asset_id, 'execution_id': result.execution_id},
                )

    async with portfolio_consolidator_service_context() as service:
        await service.recalculate_position_asset(portfolio_id, asset_id)
    # Only invalidate and rebuild returns after the position committed.
    position_service = build_portfolio_position_service_for_task()
    await position_service.invalidate_patrimony_evolution(portfolio_id)
    run_task(consolidate_portfolio_returns, portfolio_id)
