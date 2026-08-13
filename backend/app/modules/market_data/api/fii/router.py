"""Real-estate fund profile routes."""

from fastapi import APIRouter, Depends

from app.composition.market_data import get_fii_profile_read_service
from app.modules.market_data.api.fii.schemas import FIIProfileResponse
from app.modules.market_data.service.fii_service import FIIProfileReadService

router = APIRouter(prefix='/fii', tags=['FII'])


@router.get('/{asset_id}/profile', response_model=FIIProfileResponse)
async def get_fii_profile(
    asset_id: int,
    service: FIIProfileReadService = Depends(get_fii_profile_read_service),
):
    """Indicators and distribution history published for one real-estate fund."""
    return await service.get_profile(asset_id=asset_id)
