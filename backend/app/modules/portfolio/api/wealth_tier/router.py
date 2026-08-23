"""Wealth-tier routes: the ladder's CRUD and a portfolio's standing on it."""

from fastapi import APIRouter, Depends, status

from app.composition.portfolio import get_wealth_tier_service
from app.modules.portfolio.api.wealth_tier.schemas import (
    PortfolioWealthTier,
    WealthTier,
    WealthTierCreate,
    WealthTierUpdate,
)
from app.modules.portfolio.service.portfolio_wealth_tier_service import (
    PortfolioWealthTierService,
)
from app.modules.users.views import current_superuser

router = APIRouter(prefix='/wealth_tier', tags=['Wealth Tier'])


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


@router.post(
    '',
    response_model=WealthTier,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(current_superuser)],
)
async def create_wealth_tier(
    payload: WealthTierCreate,
    service: PortfolioWealthTierService = Depends(get_wealth_tier_service),
):
    """Add a rung to the ladder."""
    return await service.create_tier(
        rank=payload.rank,
        name=payload.name,
        threshold=payload.threshold,
        artwork=payload.artwork,
        artwork_offset=payload.artwork_offset,
        artwork_height=payload.artwork_height,
    )


@router.put(
    '/{tier_id}',
    response_model=WealthTier,
    dependencies=[Depends(current_superuser)],
)
async def update_wealth_tier(
    tier_id: int,
    payload: WealthTierUpdate,
    service: PortfolioWealthTierService = Depends(get_wealth_tier_service),
):
    """Rename, reprice, reorder, or re-illustrate a rung."""
    return await service.update_tier(
        tier_id=tier_id,
        rank=payload.rank,
        name=payload.name,
        threshold=payload.threshold,
        artwork=payload.artwork,
        artwork_offset=payload.artwork_offset,
        artwork_height=payload.artwork_height,
    )


@router.delete(
    '/{tier_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(current_superuser)],
)
async def delete_wealth_tier(
    tier_id: int,
    service: PortfolioWealthTierService = Depends(get_wealth_tier_service),
):
    """Remove a rung from the ladder."""
    await service.delete_tier(tier_id)
