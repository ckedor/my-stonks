import asyncio

from app.composition.portfolio import (
    build_portfolio_consolidator_write_service,
    get_portfolio_consolidator_read_service,
    get_portfolio_consolidator_write_service,
)
from app.entrypoints.worker.task_runner import run_task
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    PortfolioReturnsConsolidatorService,
)
from app.modules.portfolio.tasks.consolidate_portfolio_returns import (
    consolidate_portfolio_returns as consolidate_portfolio_returns_task,
)
from app.modules.portfolio.tasks.set_patrimony_evolution_cache import (
    set_patrimony_evolution_cache,
)
from app.modules.portfolio.tasks.set_portfolio_returns_cache import (
    set_portfolio_returns_cache,
)
from app.modules.users.views import current_superuser
from fastapi import APIRouter, Depends

router = APIRouter(
    prefix='/position_consolidator',
    tags=['Portfolio Position Consolidator'],
    dependencies=[Depends(current_superuser)],
)


async def _recalculate_assets_in_parallel(portfolio_id: int, asset_ids: list[int]) -> None:
    """Paraleliza a consolidação dos ativos, uma sessão por ativo."""

    async def _recalculate_asset_position(asset_id: int) -> None:
        service = build_portfolio_consolidator_write_service()
        try:
            await service.recalculate_position_asset(portfolio_id, asset_id)
        finally:
            await service.aclose()

    await asyncio.gather(*(_recalculate_asset_position(asset_id) for asset_id in asset_ids))


@router.post('/{portfolio_id}/consolidate')
async def consolidate_portfolio(
    portfolio_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_read_service),
):
    asset_ids = await service.get_asset_ids_to_consolidate(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_asset_position')
async def consolidate_portfolio_asset(
    portfolio_id: int,
    asset_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_write_service),
):
    await service.recalculate_position_asset(portfolio_id, asset_id)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_all_position')
async def recalculate_all_positions(
    portfolio_id: int,
    service: PortfolioConsolidatorService = Depends(get_portfolio_consolidator_read_service),
):
    asset_ids = await service.get_asset_ids_with_transactions(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_portfolio_returns')
async def consolidate_portfolio_returns(
    portfolio_id: int,
    uow: UnitOfWork = Depends(get_uow),
):
    service = PortfolioReturnsConsolidatorService(uow)
    await service.consolidate_returns(portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_category_returns')
async def consolidate_category_returns(
    portfolio_id: int,
    uow: UnitOfWork = Depends(get_uow),
):
    service = PortfolioReturnsConsolidatorService(uow)
    await service.consolidate_category_returns(portfolio_id)
    return {'message': 'OK'}
