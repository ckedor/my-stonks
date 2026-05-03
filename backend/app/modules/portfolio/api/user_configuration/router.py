from app.infra.db.session import get_session
from app.modules.portfolio.service.portfolio_user_configuration import (
    PortfolioUserConfigurationService,
)
from fastapi import APIRouter, Depends

from .schemas import UserConfigurationUpdateRequest

router = APIRouter(prefix='/user_configuration', tags=['Portfolio User Configuration'])


@router.get('/{portfolio_id}')
async def get_user_configurations(
    portfolio_id: int,
    session=Depends(get_session),
):
    service = PortfolioUserConfigurationService(session)
    return await service.get_user_configurations(portfolio_id)


@router.put('/{portfolio_id}')
async def update_user_configuration(
    portfolio_id: int,
    user_configuration_request: UserConfigurationUpdateRequest,
    session=Depends(get_session),
):
    service = PortfolioUserConfigurationService(session)
    return await service.update_user_configuration(portfolio_id, user_configuration_request)