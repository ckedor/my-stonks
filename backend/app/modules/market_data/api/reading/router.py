from typing import Annotated

from fastapi import APIRouter, Depends

from app.composition.market_data import get_market_reading_service
from app.modules.market_data.api.reading.schemas import (
    ReferenceEtfReadingResponse,
    WorldMarketReadingsResponse,
)
from app.modules.market_data.service.market_reading_service import MarketReadingService

router = APIRouter(prefix='/readings', tags=['Market Readings'])


@router.get('/world', response_model=WorldMarketReadingsResponse)
async def get_world_market_readings(
    service: Annotated[MarketReadingService, Depends(get_market_reading_service)],
):
    return await service.get_world_readings()


@router.get('/etfs', response_model=list[ReferenceEtfReadingResponse])
async def get_reference_etf_readings(
    service: Annotated[MarketReadingService, Depends(get_market_reading_service)],
):
    """The reference ETFs, in the order of the curated list: exposure first."""
    return await service.get_reference_etf_readings()
