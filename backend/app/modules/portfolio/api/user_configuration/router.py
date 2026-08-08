from app.infra.db.dependencies import get_portfolio_repository
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.service.portfolio_user_configuration import (
    PortfolioUserConfigurationService,
)
from fastapi import APIRouter, Depends

from .schemas import UserConfigurationUpdateRequest

router = APIRouter(prefix='/user_configuration', tags=['Portfolio User Configuration'])


@router.get('/{portfolio_id}')
async def get_user_configurations(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioUserConfigurationService(repository=repository)
    return await service.get_user_configurations(portfolio_id)


@router.put('/{portfolio_id}')
async def update_user_configuration(
    portfolio_id: int,
    user_configuration_request: UserConfigurationUpdateRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    service = PortfolioUserConfigurationService(uow=uow)
    return await service.update_user_configuration(portfolio_id, user_configuration_request)
