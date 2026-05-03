from app.infra.db.session import get_session
from app.modules.portfolio.api.portfolio.schemas import (
    CreatePortfolioRequest,
    Portfolio,
    UpdatePortfolioRequest,
)
from app.modules.portfolio.service.portfolio_base_service import PortfolioBaseService
from app.modules.users.models import User
from app.modules.users.views import current_active_user
from fastapi import APIRouter, Depends

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
	session=Depends(get_session),
):
	service = PortfolioBaseService(session)
	return await service.list_user_portfolios(user.id)


@router.post('')
async def create_portfolio(
	portfolio: CreatePortfolioRequest,
	user: User = Depends(current_active_user),
	session=Depends(get_session),
):
	service = PortfolioBaseService(session)
	return await service.create_portfolio(portfolio, user.id)


@router.put('/{portfolio_id}')
async def update_portfolio(
	portfolio_id: int,
	payload: UpdatePortfolioRequest,
	session=Depends(get_session),
):
	service = PortfolioBaseService(session)
	payload = payload.model_copy(update={'id': portfolio_id})
	await service.update_portfolio(payload)
	return {'message': 'Portfolio updated successfully.'}


@router.delete('/{portfolio_id}')
async def delete_portfolio(
	portfolio_id: int,
	session=Depends(get_session),
):
	service = PortfolioBaseService(session)
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
