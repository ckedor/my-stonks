from fastapi import APIRouter, Depends

from app.composition.market_data import get_market_data_read_service
from app.modules.market_data.api.currency.schemas import Currency
from app.modules.market_data.service.market_data_service import MarketDataReadService

router = APIRouter(prefix='/currency', tags=['Market Data Currency'])


@router.get('', response_model=list[Currency])
async def list_currencies(
    service: MarketDataReadService = Depends(get_market_data_read_service),
):
    """The monetary units the application works in.

    Its own route because a currency is not a market-data series: it used to
    hang off `/index`, which said the opposite.
    """
    return await service.list_currencies()
