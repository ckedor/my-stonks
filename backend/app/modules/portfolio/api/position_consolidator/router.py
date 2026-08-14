import asyncio

from fastapi import APIRouter, Depends

from app.composition.portfolio import (
    get_portfolio_consolidator_service,
    get_portfolio_position_service,
    get_portfolio_returns_consolidator_service,
    portfolio_consolidator_service_context,
)
from app.entrypoints.worker.task_runner import run_task_by_name
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    PortfolioReturnsConsolidatorService,
)
from app.modules.users.views import current_superuser

#: Dispatched by name, so the router does not import the task. See the note in
#: the transaction router.
CONSOLIDATE_PORTFOLIO_RETURNS_TASK = 'consolidate_portfolio_returns'

router = APIRouter(
    prefix='/position_consolidator',
    tags=['Portfolio Position Consolidator'],
    dependencies=[Depends(current_superuser)],
)


async def _recalculate_assets_in_parallel(portfolio_id: int, asset_ids: list[int]) -> None:
    """Paraleliza a consolidação dos ativos, uma sessão por ativo."""

    async def _recalculate_asset_position(asset_id: int) -> None:
        async with portfolio_consolidator_service_context() as service:
            await service.recalculate_position_asset(portfolio_id, asset_id)

    await asyncio.gather(*(_recalculate_asset_position(asset_id) for asset_id in asset_ids))


@router.post('/{portfolio_id}/consolidate')
async def consolidate_portfolio(
    portfolio_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_service),
    position_service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    asset_ids = await service.get_asset_ids_to_consolidate(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    await position_service.invalidate_cached_analytics(portfolio_id)
    run_task_by_name(CONSOLIDATE_PORTFOLIO_RETURNS_TASK, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_asset_position')
async def consolidate_portfolio_asset(
    portfolio_id: int,
    asset_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_service),
    position_service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    await service.recalculate_position_asset(portfolio_id, asset_id)
    await position_service.invalidate_cached_analytics(portfolio_id)
    run_task_by_name(CONSOLIDATE_PORTFOLIO_RETURNS_TASK, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_all_position')
async def recalculate_all_positions(
    portfolio_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_service),
    position_service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    asset_ids = await service.get_asset_ids_with_transactions(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    await position_service.invalidate_cached_analytics(portfolio_id)
    run_task_by_name(CONSOLIDATE_PORTFOLIO_RETURNS_TASK, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_portfolio_returns')
async def consolidate_portfolio_returns(
    portfolio_id: int,
    service: PortfolioReturnsConsolidatorService = Depends(
        get_portfolio_returns_consolidator_service
    ),
):
    await service.consolidate_returns(portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_category_returns')
async def consolidate_category_returns(
    portfolio_id: int,
    service: PortfolioReturnsConsolidatorService = Depends(
        get_portfolio_returns_consolidator_service
    ),
):
    await service.consolidate_category_returns(portfolio_id)
    return {'message': 'OK'}
