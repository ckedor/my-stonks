from fastapi import APIRouter, Depends

from app.composition.portfolio import get_portfolio_service
from app.modules.portfolio.api.portfolio.schemas import (
    CreatePortfolioRequest,
    Portfolio,
    PortfolioSummary,
    UpdatePortfolioRequest,
)
from app.modules.portfolio.service.portfolio_base_service import PortfolioBaseService
from app.modules.users.domain import User
from app.modules.users.views import current_active_user, current_superuser

from .category.router import router as category_router
from .dividend.router import router as dividend_router
from .income_tax.router import router as income_tax_router
from .position.router import router as position_router
from .position_consolidator.router import router as position_consolidator_router
from .rebalancing.router import router as rebalancing_router
from .report.router import router as report_router
from .transaction.router import router as transaction_router
from .user_configuration.router import router as user_configuration_router

router = APIRouter(prefix='/portfolio', dependencies=[Depends(current_active_user)])


@router.get('', response_model=list[Portfolio])
async def list_user_portfolios(
    user: User = Depends(current_active_user),
    service: PortfolioBaseService = Depends(get_portfolio_service),
):
    return await service.list_user_portfolios(user.id)


@router.get(
    '/all',
    response_model=list[PortfolioSummary],
    dependencies=[Depends(current_superuser)],
)
async def list_all_portfolios(
    service: PortfolioBaseService = Depends(get_portfolio_service),
):
    """Every portfolio in the application, for administrative screens."""
    return await service.list_all_portfolios()


@router.post('')
async def create_portfolio(
    portfolio: CreatePortfolioRequest,
    user: User = Depends(current_active_user),
    service: PortfolioBaseService = Depends(get_portfolio_service),
):
    return await service.create_portfolio(
        user.id,
        name=portfolio.name,
        categories=portfolio.categories_to_domain(),
    )


@router.put('/{portfolio_id}')
async def update_portfolio(
    portfolio_id: int,
    payload: UpdatePortfolioRequest,
    service: PortfolioBaseService = Depends(get_portfolio_service),
):
    await service.update_portfolio(
        portfolio_id,
        name=payload.name,
        categories=payload.categories_to_domain(),
    )
    return {'message': 'Portfolio updated successfully.'}


@router.delete('/{portfolio_id}')
async def delete_portfolio(
    portfolio_id: int,
    service: PortfolioBaseService = Depends(get_portfolio_service),
):
    await service.delete_portfolio(portfolio_id)
    return {'message': 'Portfolio deleted successfully.'}


router.include_router(dividend_router)
router.include_router(category_router)
router.include_router(transaction_router)
router.include_router(position_router)
router.include_router(position_consolidator_router)
router.include_router(income_tax_router)
router.include_router(user_configuration_router)
router.include_router(report_router)
router.include_router(rebalancing_router)

__all__ = ['router']
