from typing import List

from fastapi import APIRouter, Depends

from app.composition.market_data import get_market_data_read_service
from app.modules.market_data.api.index.schemas import MarketDataSeriesResponse
from app.modules.market_data.service.market_data_service import MarketDataReadService

router = APIRouter(prefix='/series', tags=['Market Data Series'])


@router.get('', response_model=List[MarketDataSeriesResponse])
async def list_market_data_series(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.list_market_data_series()
