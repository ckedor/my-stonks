from datetime import date

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import get_market_data_read_service
from app.modules.market_data.api.series.schemas import (
    MarketDataSeriesHistoryPoint,
    MarketDataSeriesOption,
    MarketDataSeriesResponse,
    MarketDataSeriesTimeSeries,
)
from app.modules.market_data.service.market_data_service import MarketDataReadService

router = APIRouter(prefix='/series', tags=['Market Data Series'])


@router.get('', response_model=list[MarketDataSeriesResponse])
async def list_market_data_series(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.list_market_data_series()


@router.get('/options', response_model=list[MarketDataSeriesOption])
async def list_market_data_series_options(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    """Selectable series, for pickers that only need identity."""
    return await service.list_market_data_series()


@router.get('/time_series', response_model=MarketDataSeriesTimeSeries)
async def get_series_time_series(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    """Every series' history at once, keyed by short name, for charting."""
    return await service.get_all_series_history()


@router.get('/{series_id}/history', response_model=list[MarketDataSeriesHistoryPoint])
async def get_market_data_series_history(
    series_id: int,
    start_date: date | None = Query(default=None),
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.get_series_history(series_id, start_date=start_date)
