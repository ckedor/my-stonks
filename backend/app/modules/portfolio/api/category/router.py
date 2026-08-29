from fastapi import APIRouter, Depends

from app.composition.portfolio import (
    get_portfolio_category_service,
    get_portfolio_position_service,
)
from app.modules.portfolio.service.portfolio_category_service import (
    PortfolioCategoryService,
)
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)

from .schema import CategoryAssignmentRequest, SaveCategoriesRequest

router = APIRouter(prefix='/category', tags=['Portfolio Category'])


@router.post('')
async def save_custom_category(
    payload: SaveCategoriesRequest,
    service: PortfolioCategoryService = Depends(get_portfolio_category_service),
):
    await service.save_custom_categories(payload.categories)
    return {'message': 'Custom category saved successfully.'}


@router.delete('/{category_id}')
async def delete_custom_category(
    category_id: int,
    service: PortfolioCategoryService = Depends(get_portfolio_category_service),
):
    await service.delete_custom_category(category_id)
    return {'message': 'Custom category deleted successfully.'}


@router.post('/assignment')
async def assign_category_to_assets(
    payload: CategoryAssignmentRequest,
    service: PortfolioCategoryService = Depends(get_portfolio_category_service),
    position_service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    await service.assign_category_to_asset(payload)
    await position_service.invalidate_patrimony_evolution(payload.portfolio_id)
    return {'message': 'Category assigned to assets successfully.'}
