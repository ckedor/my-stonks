from fastapi import APIRouter, Depends

from app.composition.portfolio import get_portfolio_user_configuration_service
from app.modules.portfolio.service.portfolio_user_configuration import (
    PortfolioUserConfigurationService,
)

from .schemas import UserConfigurationUpdateRequest

router = APIRouter(prefix='/user_configuration', tags=['Portfolio User Configuration'])


@router.get('/{portfolio_id}')
async def get_user_configurations(
    portfolio_id: int,
    service: PortfolioUserConfigurationService = Depends(get_portfolio_user_configuration_service),
):
    return await service.get_user_configurations(portfolio_id)


@router.put('/{portfolio_id}')
async def update_user_configuration(
    portfolio_id: int,
    user_configuration_request: UserConfigurationUpdateRequest,
    service: PortfolioUserConfigurationService = Depends(get_portfolio_user_configuration_service),
):
    return await service.update_user_configuration(
        portfolio_id,
        configuration=user_configuration_request.configuration,
        enabled=user_configuration_request.enabled,
    )
