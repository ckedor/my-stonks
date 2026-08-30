"""Wealth-tier routes: the fixed ladder, and a portfolio's standing on it."""

from fastapi import APIRouter, Depends

from app.composition.portfolio import get_wealth_tier_service
from app.modules.portfolio.api.wealth_tier.schemas import (
    PortfolioWealthTier,
    WealthTier,
)
from app.modules.portfolio.service.portfolio_wealth_tier_service import (
    PortfolioWealthTierService,
)

router = APIRouter(prefix='/wealth_tier', tags=['Wealth Tier'])

# Sem POST, PUT ou DELETE: a escala é fixa em código, ao lado dos cenários
# desenhados para ela. Ver `domain.wealth_tier_ladder`.


@router.get('', response_model=list[WealthTier])
async def list_wealth_tiers(
    service: PortfolioWealthTierService = Depends(get_wealth_tier_service),
):
    """The whole ladder, lowest rung first."""
    return await service.list_tiers()


@router.get('/status/{portfolio_id}', response_model=PortfolioWealthTier)
async def get_portfolio_wealth_tier(
    portfolio_id: int,
    service: PortfolioWealthTierService = Depends(get_wealth_tier_service),
):
    """The tier a portfolio has earned, and how far the next one is."""
    return await service.get_portfolio_tier(portfolio_id)
