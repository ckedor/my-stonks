"""Market index, currency and exchange-rate routes."""

from typing import List

from app.entrypoints.worker.task_runner import run_task
from app.infra.db.session import get_session
from app.modules.market_data.api.index.schemas import (
    Currency,
    MarketIndex,
    MarketIndexesTimeSeries,
    USD_BRL_History,
)
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.market_data.tasks.set_indexes_history_cache import (
    set_indexes_history_cache,
)
from app.modules.users.models import User
from app.modules.users.views import current_superuser
from fastapi import APIRouter, Depends

router = APIRouter(prefix='/index', tags=['Index'])


@router.get('/currency', response_model=List[Currency])
async def list_currencies(
    session=Depends(get_session),
):
    """List all available currencies"""
    service = MarketDataService(session)
    return await service.list_currencies()


@router.get('/time_series', response_model=MarketIndexesTimeSeries)
async def get_indexes_time_series(
    session=Depends(get_session),
):
    """Get historical time series data for all indexes"""
    service = MarketDataService(session)
    return await service.get_indexes_history()


@router.get('/usd_brl', response_model=USD_BRL_History)
async def get_usd_brl_history(
    session=Depends(get_session),
):
    """Get USD/BRL exchange rate history"""
    service = MarketDataService(session)
    return await service.get_usd_brl_history(as_df=False)


@router.post('/consolidate_history')
async def consolidate_market_indexes_history(
    _: User = Depends(current_superuser),
    session=Depends(get_session),
):
    """Consolidate market indexes history from external providers."""
    service = MarketDataService(session)
    await service.consolidate_market_indexes_history()
    run_task(set_indexes_history_cache)
    return {'message': 'OK'}


@router.get('', response_model=List[MarketIndex])
async def list_indexes(
    session=Depends(get_session),
):
    """List all available market indexes"""
    service = MarketDataService(session)
    return await service.list_indexes()
