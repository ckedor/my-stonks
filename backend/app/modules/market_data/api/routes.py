# app/modules/market_data/api/routes.py
"""
Market data API routes.
Handles market indexes, USD/BRL history, and asset quotes.
"""

from typing import List

from app.entrypoints.worker.task_runner import run_task
from app.infra.db.session import get_session
from app.modules.market_data.api.schemas import (
    Currency,
    MarketIndex,
    MarketIndexesTimeSeries,
    QuoteResponse,
    USD_BRL_History,
)
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.market_data.tasks.set_indexes_history_cache import (
    set_indexes_history_cache,
)
from app.modules.users.models import User
from app.modules.users.views import current_active_user, current_superuser
from fastapi import APIRouter, Depends
from fastapi.params import Query

router = APIRouter(
    prefix='/market_data',
    tags=['Market Data'],
    dependencies=[Depends(current_active_user)]
)


@router.get('/currency', response_model=List[Currency])
async def list_currencies(
    session=Depends(get_session),
):
    """List all available currencies"""
    service = MarketDataService(session)
    return await service.list_currencies()


@router.get('/indexes', response_model=List[MarketIndex])
async def list_indexes(
    session=Depends(get_session),
):
    """List all available market indexes"""
    service = MarketDataService(session)
    return await service.list_indexes()


@router.get('/indexes/time_series', response_model=MarketIndexesTimeSeries)
async def get_indexes_time_series(
    session=Depends(get_session),
):
    """Get historical time series data for all indexes"""
    service = MarketDataService(session)
    return await service.get_indexes_history()


@router.get('/indexes/usd_brl', response_model=USD_BRL_History)
async def get_usd_brl_history(
    session=Depends(get_session),
):
    """Get USD/BRL exchange rate history"""
    service = MarketDataService(session)
    return await service.get_usd_brl_history(as_df=False)


@router.post('/indexes/consolidate_history')
async def consolidate_market_indexes_history(
    _: User = Depends(current_superuser),
    session=Depends(get_session),
):
    """
    Consolidate market indexes history from external providers.
    Requires superuser permissions.
    """
    service = MarketDataService(session)
    await service.consolidate_market_indexes_history()
    run_task(set_indexes_history_cache)
    return {'message': 'OK'}


@router.get('/quotes', response_model=QuoteResponse)
async def get_asset_quotes(
    ticker: str,
    session=Depends(get_session),
    asset_type: str | None = Query(
        default=None,
        description="Asset type (STOCK, ETF, FII, etc)",
    ),
    exchange: EXCHANGE | None = Query(
        default=None,
        description="Exchange code (B3, NASDAQ, NYSE, etc)"
    ),
    date: str | None = Query(
        default=None,
        description="Specific date (YYYY-MM-DD)"
    ),
    start_date: str | None = Query(
        default=None,
        description="Range start date (YYYY-MM-DD)"
    ),
    end_date: str | None = Query(
        default=None,
        description="Range end date (YYYY-MM-DD)"
    ),
    treasury_type: str | None = Query(
        default=None,
        description="Treasury bond type (for Brazilian treasury bonds)"
    ),
    treasury_maturity_date: str | None = Query(
        default=None,
        description="Treasury maturity date (for Brazilian treasury bonds)"
    ),
):
    """
    Get asset price quotes (OHLCV data).
    Supports single date or date range queries.
    """
    service = MarketDataService(session)
    return await service.get_asset_quotes(
        ticker,
        asset_type,
        exchange,
        date,
        start_date,
        end_date,
        treasury_type,
        treasury_maturity_date,
    )
