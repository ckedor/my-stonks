"""Compatibility routes for the former market-index URL."""

from fastapi import APIRouter, Depends

from app.composition.market_data import (
    get_market_data_read_service,
)
from app.modules.market_data.api.index.schemas import (
    Currency,
    MarketIndex,
    MarketIndexesTimeSeries,
    USD_BRL_History,
)
from app.modules.market_data.service.market_data_service import MarketDataReadService

router = APIRouter(prefix='/index', tags=['Market Data Series'])


@router.get('/currency', response_model=list[Currency])
async def list_currencies(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.list_currencies()


@router.get('/time_series', response_model=MarketIndexesTimeSeries)
async def get_indexes_time_series(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.get_indexes_history()


@router.get('/usd_brl', response_model=USD_BRL_History)
async def get_usd_brl_history(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.get_usd_brl_history(as_df=False)


@router.get('', response_model=list[MarketIndex])
async def list_indexes(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    return await service.list_indexes()
