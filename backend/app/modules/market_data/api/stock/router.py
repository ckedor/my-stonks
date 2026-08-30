"""Listed-company profile routes."""

from fastapi import APIRouter, Depends

from app.composition.market_data import get_stock_profile_read_service
from app.modules.market_data.api.stock.schemas import StockProfileResponse
from app.modules.market_data.service.stock_service import StockProfileReadService

router = APIRouter(prefix='/stock', tags=['Stock'])


@router.get('/{asset_id}/profile', response_model=StockProfileResponse)
async def get_stock_profile(
    asset_id: int,
    service: StockProfileReadService = Depends(get_stock_profile_read_service),
):
    """Filings, multiples and payment history published for one listed company."""
    return await service.get_profile(asset_id=asset_id)
