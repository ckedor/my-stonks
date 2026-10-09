"""Persisted and on-demand asset quote routes."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_asset_quote_history_service,
    get_on_demand_quote_read_service,
    get_persisted_quote_read_service,
)
from app.modules.market_data.api.quote.schemas import (
    AssetQuoteHistoryResponse,
    OnDemandQuotesResponse,
    PersistedQuotesResponse,
)
from app.modules.market_data.service.quote_service import (
    AssetQuoteHistoryService,
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)

router = APIRouter(prefix='/quotes', tags=['Quotes'])
MAX_ASSETS_PER_PERSISTED_QUERY = 100
MAX_TICKER_LENGTH = 30


@router.get('/persisted', response_model=list[PersistedQuotesResponse])
async def get_persisted_quotes(
    service: Annotated[PersistedQuoteReadService, Depends(get_persisted_quote_read_service)],
    asset_ids: Annotated[list[int] | None, Query(max_length=MAX_ASSETS_PER_PERSISTED_QUERY)] = None,
    tickers: Annotated[list[str] | None, Query(max_length=MAX_ASSETS_PER_PERSISTED_QUERY)] = None,
    asset_type_id: Annotated[int | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
):
    return await service.get_quotes(
        asset_ids=asset_ids,
        tickers=tickers,
        asset_type_id=asset_type_id,
        start_date=start_date,
    )


@router.get('/asset/{asset_id}', response_model=AssetQuoteHistoryResponse)
async def get_asset_quote_history(
    asset_id: int,
    service: Annotated[AssetQuoteHistoryService, Depends(get_asset_quote_history_service)],
    start_date: Annotated[date | None, Query()] = None,
    currency: Annotated[str, Query()] = 'BRL',
):
    """Quote history for one asset, from storage when it exists.

    Prices come back in ``currency``, converted through the USD/BRL history when
    the asset is not quoted in it.
    """
    return await service.get_history(
        asset_id=asset_id,
        start_date=start_date,
        currency=currency,
    )


@router.get('/on-demand', response_model=OnDemandQuotesResponse)
async def get_on_demand_quotes(
    ticker: Annotated[str, Query(min_length=1, max_length=MAX_TICKER_LENGTH)],
    asset_type_id: Annotated[int, Query(ge=1)],
    service: Annotated[OnDemandQuoteReadService, Depends(get_on_demand_quote_read_service)],
    start_date: Annotated[date | None, Query()] = None,
    exchange: Annotated[str | None, Query(max_length=10)] = None,
):
    return await service.get_quotes(
        ticker=ticker,
        asset_type_id=asset_type_id,
        start_date=start_date,
        exchange=exchange,
    )
