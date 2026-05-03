"""Asset price quote routes."""

from app.infra.db.session import get_session
from app.modules.market_data.api.quote.schemas import QuoteResponse
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.service.market_data_service import MarketDataService
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/quote', tags=['Quote'])


@router.get('', response_model=QuoteResponse)
async def get_asset_quotes(
    ticker: str,
    session=Depends(get_session),
    asset_type: str | None = Query(
        default=None,
        description="Asset type (STOCK, ETF, FII, etc)",
    ),
    exchange: EXCHANGE | None = Query(
        default=None,
        description="Exchange code (B3, NASDAQ, NYSE, etc)",
    ),
    date: str | None = Query(
        default=None,
        description="Specific date (YYYY-MM-DD)",
    ),
    start_date: str | None = Query(
        default=None,
        description="Range start date (YYYY-MM-DD)",
    ),
    end_date: str | None = Query(
        default=None,
        description="Range end date (YYYY-MM-DD)",
    ),
    treasury_type: str | None = Query(
        default=None,
        description="Treasury bond type (for Brazilian treasury bonds)",
    ),
    treasury_maturity_date: str | None = Query(
        default=None,
        description="Treasury maturity date (for Brazilian treasury bonds)",
    ),
):
    """Get asset price quotes (OHLCV data). Supports single date or range."""
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
