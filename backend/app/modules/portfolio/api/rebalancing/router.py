from app.infra.db.dependencies import get_portfolio_repository
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.service.portfolio_rebalancing_service import (
    PortfolioRebalancingService,
)
from fastapi import APIRouter, Depends

from .schema import RebalancingResponse, SaveTargetsRequest

router = APIRouter(prefix='/rebalancing', tags=['Portfolio Rebalancing'])


@router.get('/{portfolio_id}', response_model=RebalancingResponse)
async def get_rebalancing(
    portfolio_id: int,
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioRebalancingService(repository=repository)
    return await service.get_rebalancing_data(portfolio_id)


@router.put('/{portfolio_id}')
async def save_rebalancing_targets(
    portfolio_id: int,
    payload: SaveTargetsRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    service = PortfolioRebalancingService(uow=uow)
    await service.save_targets(payload)
    return {'message': 'Targets de rebalanceamento salvos com sucesso.'}
