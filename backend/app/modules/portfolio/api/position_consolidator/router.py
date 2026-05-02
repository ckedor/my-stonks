import asyncio

from app.config.logger import logger
from app.entrypoints.worker.task_runner import run_task
from app.infra.db.session import AsyncSessionLocal, get_session
from app.modules.portfolio.repositories import PortfolioRepository
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

router = APIRouter(tags=['Portfolio Consolidator'], dependencies=[Depends(current_superuser)])


async def _recalculate_assets_in_parallel(
    portfolio_id: int, asset_ids: list[int]
) -> None:
    """Paraleliza a consolidação dos ativos, uma sessão por ativo."""

    async def _recalculate_asset_position(asset_id: int) -> None:
        async with AsyncSessionLocal() as session:
            await PortfolioConsolidatorService(
                session
            ).recalculate_position_asset(portfolio_id, asset_id)

    await asyncio.gather(
        *(_recalculate_asset_position(asset_id) for asset_id in asset_ids)
    )


@router.post('/{portfolio_id}/consolidate')
async def consolidate_portfolio(
    portfolio_id: int,
    session = Depends(get_session)
):
    asset_ids = await PortfolioConsolidatorService(
        session
    ).get_asset_ids_to_consolidate(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_asset_position')
async def consolidate_portfolio_asset(
    portfolio_id: int,
    asset_id: int,
    session = Depends(get_session)
):
    service = PortfolioConsolidatorService(session)
    await service.recalculate_position_asset(portfolio_id, asset_id)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/recalculate_all_positions')
async def recalculate_all_positions(
    portfolio_id: int,
    session = Depends(get_session)
):
    asset_ids = await PortfolioConsolidatorService(
        session
    ).get_asset_ids_with_transactions(portfolio_id)
    await _recalculate_assets_in_parallel(portfolio_id, asset_ids)
    run_task(set_patrimony_evolution_cache, portfolio_id)
    run_task(consolidate_portfolio_returns_task, portfolio_id)
    run_task(set_portfolio_returns_cache, portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_portfolio_returns')
async def consolidate_portfolio_returns(
    portfolio_id: int,
    session=Depends(get_session),
):
    service = PortfolioReturnsConsolidatorService(session)
    await service.consolidate_returns(portfolio_id)
    return {'message': 'OK'}


@router.post('/{portfolio_id}/consolidate_category_returns')
async def consolidate_category_returns(
    portfolio_id: int,
    session=Depends(get_session),
):
    service = PortfolioReturnsConsolidatorService(session)
    await service.consolidate_category_returns(portfolio_id)
    return {'message': 'OK'}