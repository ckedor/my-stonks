from fastapi import APIRouter, Depends

from app.composition.portfolio import get_portfolio_rebalancing_service
from app.modules.portfolio.service.portfolio_rebalancing_service import (
    PortfolioRebalancingService,
)

from .schema import RebalancingResponse, SaveTargetsRequest

router = APIRouter(prefix='/rebalancing', tags=['Portfolio Rebalancing'])


@router.get('/{portfolio_id}', response_model=RebalancingResponse)
async def get_rebalancing(
    portfolio_id: int,
    service: PortfolioRebalancingService = Depends(get_portfolio_rebalancing_service),
):
    return await service.get_rebalancing_data(portfolio_id)


@router.put('/{portfolio_id}')
async def save_rebalancing_targets(
    portfolio_id: int,
    payload: SaveTargetsRequest,
    service: PortfolioRebalancingService = Depends(get_portfolio_rebalancing_service),
):
    await service.save_targets(portfolio_id, categories=payload.categories_to_domain())
    return {'message': 'Targets de rebalanceamento salvos com sucesso.'}
