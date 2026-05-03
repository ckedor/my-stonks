from app.entrypoints.worker.task_runner import run_task
from app.infra.db.session import get_session
from app.modules.portfolio.service.portfolio_category_service import (
    PortfolioCategoryService,
)
from app.modules.portfolio.tasks.set_patrimony_evolution_cache import (
    set_patrimony_evolution_cache,
)
from app.modules.portfolio.tasks.set_portfolio_returns_cache import (
    set_portfolio_returns_cache,
)
from fastapi import APIRouter, Depends

from .schema import CategoryAssignmentRequest, SaveCategoriesRequest

router = APIRouter(prefix='/category', tags=['Portfolio Category'])


@router.post('')
async def save_custom_category(
    payload: SaveCategoriesRequest,
    session=Depends(get_session),
):
    service = PortfolioCategoryService(session)
    await service.save_custom_categories(payload.categories)
    return {'message': 'Custom category saved successfully.'}


@router.delete('/{category_id}')
async def delete_custom_category(
    category_id: int,
    session=Depends(get_session),
):
    service = PortfolioCategoryService(session)
    await service.delete_custom_category(category_id)
    return {'message': 'Custom category deleted successfully.'}


@router.post('/assignment')
async def assign_category_to_assets(
    payload: CategoryAssignmentRequest,
    session=Depends(get_session),
):
    service = PortfolioCategoryService(session)
    await service.assign_category_to_asset(payload)

    run_task(set_patrimony_evolution_cache, payload.portfolio_id)
    run_task(set_portfolio_returns_cache, payload.portfolio_id)
    return {'message': 'Category assigned to assets successfully.'}
