"""Persisted and on-demand asset quote routes."""

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_on_demand_quote_read_service,
    get_persisted_quote_read_service,
)
from app.modules.market_data.api.quote.schemas import (
    OnDemandQuotesResponse,
    PersistedQuotesResponse,
)
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)

router = APIRouter(prefix='/quotes', tags=['Quotes'])
MAX_ASSETS_PER_PERSISTED_QUERY = 100
MAX_TICKER_LENGTH = 30


@router.get('/persisted', response_model=list[PersistedQuotesResponse])
async def get_persisted_quotes(
    asset_ids: list[int] | None = Query(
        default=None,
        max_length=MAX_ASSETS_PER_PERSISTED_QUERY,
    ),
    tickers: list[str] | None = Query(
        default=None,
        max_length=MAX_ASSETS_PER_PERSISTED_QUERY,
    ),
    asset_type_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    service: PersistedQuoteReadService = Depends(get_persisted_quote_read_service),
):
    return await service.get_quotes(
        asset_ids=asset_ids,
        tickers=tickers,
        asset_type_id=asset_type_id,
        start_date=start_date,
    )


@router.get('/on-demand', response_model=OnDemandQuotesResponse)
async def get_on_demand_quotes(
    ticker: str = Query(min_length=1, max_length=MAX_TICKER_LENGTH),
    asset_type_id: int = Query(ge=1),
    start_date: date | None = Query(default=None),
    exchange: str | None = Query(default=None, max_length=10),
    service: OnDemandQuoteReadService = Depends(get_on_demand_quote_read_service),
):
    return await service.get_quotes(
        ticker=ticker,
        asset_type_id=asset_type_id,
        start_date=start_date,
        exchange=exchange,
    )
