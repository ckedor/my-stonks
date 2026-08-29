"""One consolidation per portfolio: positions, then every return series.

It used to be two tasks dispatched side by side, which meant nothing knew when
the pair had finished -- so nothing could say when the portfolio was last
rebuilt. Here the two phases are one run, and the stamp is written at the end of
it.
"""

import asyncio

from app.composition.portfolio import (
    build_portfolio_position_service_for_task,
    build_portfolio_returns_consolidator_for_task,
    portfolio_consolidator_service_context,
)
from app.config.logger import logger
from app.entrypoints.worker.task_runner import celery_async_task
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    CONSOLIDATION_FAILURE,
    CONSOLIDATION_PARTIAL,
    CONSOLIDATION_SUCCESS,
)


@celery_async_task(name='consolidate_portfolio')
async def consolidate_portfolio(portfolio_id: int):
    logger.info(f'🟢 consolidate_portfolio para {portfolio_id}')
    failed_asset_ids: list[int] = []
    try:
        async with portfolio_consolidator_service_context() as service:
            asset_ids = await service.get_asset_ids_to_consolidate(portfolio_id)

        # Uma sessão por ativo: a consolidação de cada um é independente.
        async def _recalculate_asset_position(asset_id: int) -> None:
            async with portfolio_consolidator_service_context() as service:
                try:
                    await service.recalculate_position_asset(portfolio_id, asset_id)
                except Exception as e:
                    failed_asset_ids.append(asset_id)
                    logger.error(
                        f'Falha ao recalcular ativo {asset_id} do portfolio {portfolio_id}: {e}'
                    )

        await asyncio.gather(*(_recalculate_asset_position(asset_id) for asset_id in asset_ids))

        # As posições estão escritas, então a série de patrimônio derivada delas
        # é a que ficou velha. Invalidar antes do gather devolveria o cache
        # preenchido com os números antigos.
        position_service = build_portfolio_position_service_for_task()
        await position_service.invalidate_patrimony_evolution(portfolio_id)

        consolidator = build_portfolio_returns_consolidator_for_task()
        await consolidator.consolidate_returns(portfolio_id)
        await consolidator.mark_consolidated(
            portfolio_id,
            status=CONSOLIDATION_PARTIAL if failed_asset_ids else CONSOLIDATION_SUCCESS,
            error=(
                f'Falha ao recalcular os ativos {sorted(failed_asset_ids)}'
                if failed_asset_ids
                else None
            ),
        )
    except Exception as e:
        logger.error(f'❌ Erro em consolidate_portfolio: {e}', exc_info=True)
        # O carimbo tem de contar a falha: sem isso a tela mostra o horário da
        # última consolidação bem-sucedida como se fosse o dado de agora.
        try:
            await build_portfolio_returns_consolidator_for_task().mark_consolidated(
                portfolio_id,
                status=CONSOLIDATION_FAILURE,
                error=str(e) or e.__class__.__name__,
            )
        except Exception:
            logger.exception('Falha ao registrar o carimbo de consolidação')
