"""Investment-fund profile routes.

An investment fund here is one that is neither a real-estate fund nor an ETF.
A FII is answered by ``/market_data/fii``, which is about buildings and vacancy;
an ETF is read like any other listed asset.
"""

from fastapi import APIRouter, Depends

from app.composition.market_data import (
    get_investment_fund_market_read_service,
    get_investment_fund_profile_read_service,
)
from app.modules.market_data.api.investment_fund.schemas import (
    InvestmentFundMarketResponse,
    InvestmentFundProfileResponse,
)
from app.modules.market_data.service.investment_fund_service import (
    InvestmentFundMarketReadService,
    InvestmentFundProfileReadService,
)

router = APIRouter(prefix='/investment_fund', tags=['Investment fund'])


@router.get('/market', response_model=InvestmentFundMarketResponse)
async def get_investment_fund_market(
    service: InvestmentFundMarketReadService = Depends(get_investment_fund_market_read_service),
):
    """Catalogue of funds that are neither real-estate funds nor ETFs."""
    return await service.list_market()


@router.get('/{asset_id}/profile', response_model=InvestmentFundProfileResponse)
async def get_investment_fund_profile(
    asset_id: int,
    service: InvestmentFundProfileReadService = Depends(get_investment_fund_profile_read_service),
):
    """Registration, indicators, share value, payments and portfolio of one fund."""
    return await service.get_profile(asset_id=asset_id)
