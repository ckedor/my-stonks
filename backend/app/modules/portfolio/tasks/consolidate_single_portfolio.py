import asyncio

from app.composition.portfolio import portfolio_consolidator_service_context
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task


@celery_async_task(name='consolidate_single_portfolio')
async def consolidate_single_portfolio(portfolio_id: int):
    logger.info(f'🟢 consolidate_single_portfolio para {portfolio_id}')
    try:
        async with portfolio_consolidator_service_context() as service:
            asset_ids = await service.get_asset_ids_to_consolidate(portfolio_id)

        # 2) Paraleliza a consolidação, uma sessão por ativo.
        async def _recalculate_asset_position(asset_id: int) -> None:
            async with portfolio_consolidator_service_context() as service:
                try:
                    await service.recalculate_position_asset(portfolio_id, asset_id)
                except Exception as e:
                    logger.error(
                        f'Falha ao recalcular ativo {asset_id} do portfolio {portfolio_id}: {e}'
                    )

        await asyncio.gather(*(_recalculate_asset_position(asset_id) for asset_id in asset_ids))
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_single_portfolio: {e}', exc_info=True)
