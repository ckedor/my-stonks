"""ETF market-page routes: the registered fund and what it holds."""

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import get_etf_read_service
from app.modules.market_data.api.etf.schemas import EtfHoldingsPageResponse, EtfProfileResponse
from app.modules.market_data.service.etf_service import EtfReadService

router = APIRouter(prefix='/etf', tags=['ETF'])


@router.get('/{asset_id}/profile', response_model=EtfProfileResponse)
async def get_etf_profile(
    asset_id: int,
    service: EtfReadService = Depends(get_etf_read_service),
):
    """The fund and share class the ETF is registered as, and its latest report."""
    return await service.get_profile(asset_id=asset_id)


@router.get('/{asset_id}/holdings', response_model=EtfHoldingsPageResponse)
async def get_etf_holdings(
    asset_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: EtfReadService = Depends(get_etf_read_service),
):
    """One page of the latest holding report, largest position first."""
    return await service.get_holdings(asset_id=asset_id, page=page, page_size=page_size)
