from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.composition.portfolio import get_portfolio_dividend_service
from app.modules.portfolio.api.dividend.schema import (
    Dividend,
    DividendCreateRequest,
    DividendFilters,
    DividendUpdateRequest,
)
from app.modules.portfolio.service.portfolio_dividend_service import (
    PortfolioDividendService,
)

router = APIRouter(prefix='/dividend', tags=['Portfolio Dividend'])


@router.get('', response_model=list[Dividend])
async def list_dividends(
    portfolio_id: int = Query(...),
    filters: Annotated[DividendFilters, Depends()] = None,
    currency: str = Query('BRL'),
    service: PortfolioDividendService = Depends(get_portfolio_dividend_service),
):
    return await service.get_dividends(portfolio_id, filters.to_domain(), currency=currency)


@router.post('')
async def create_dividend(
    dividend: DividendCreateRequest,
    service: PortfolioDividendService = Depends(get_portfolio_dividend_service),
):
    return await service.create_dividend(dividend)


@router.put('/{dividend_id}')
async def update_dividend(
    dividend_id: int,
    dividend_data: DividendUpdateRequest,
    service: PortfolioDividendService = Depends(get_portfolio_dividend_service),
):
    payload = dividend_data.model_copy(update={'id': dividend_id})
    updated = await service.update_dividend(payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Dividend not found')
    return updated


@router.delete('/{dividend_id}')
async def delete_dividend(
    dividend_id: int,
    service: PortfolioDividendService = Depends(get_portfolio_dividend_service),
):
    deleted = await service.delete_dividend(dividend_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Dividend not found')
    return {'detail': 'Dividend deleted successfully'}
