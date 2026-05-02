from typing import List, Optional

from app.infra.db.session import get_session
from app.lib.utils.fastapi import df_response
from app.modules.market_data.api.asset.schemas import AssetDetailsWithPosition
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)
from fastapi import APIRouter, Depends, Query

router = APIRouter()


@router.get('/{portfolio_id}/returns', tags=['Portfolio Data'])
async def get_portfolio_returns(
    portfolio_id: int,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_portfolio_returns(portfolio_id, currency)


@router.get('/{portfolio_id}/position', tags=['Portfolio Data'])
async def get_portfolio_position(
    portfolio_id: int,
    most_recent: bool = Query(True),
    group_by_broker: bool = Query(False),
    asset_id: int = Query(None),
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    if most_recent:
        return await service.get_portfolio_position(portfolio_id, group_by_broker=group_by_broker, currency=currency)
    return await service.get_portfolio_position_history(portfolio_id, asset_id, currency=currency)


@router.get('/{portfolio_id}/patrimony_evolution', tags=['Portfolio Data'])
async def get_patrimony_evolution(
    portfolio_id: int,
    asset_id: int = Query(None),
    asset_type_id: int = Query(None),
    asset_type_ids: Optional[List[int]] = Query(None),
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_patrimony_evolution(portfolio_id, asset_id, asset_type_id, asset_type_ids, currency=currency)


@router.get('/{portfolio_id}/analysis', tags=['Portfolio Data'])
async def get_portfolio_analysis(
    portfolio_id: int,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_portfolio_stats(portfolio_id, currency=currency)


@router.get('/{portfolio_id}/category/returns', tags=['Portfolio Category Data'])
async def get_category_returns(
    portfolio_id: int,
    category_id: int = Query(None),
    most_recent: bool = Query(False),
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_category_returns(portfolio_id, category_id, most_recent, currency)


@router.get('/{portfolio_id}/category/{category_id}/analysis', tags=['Portfolio Category Data'])
async def get_category_analysis(
    portfolio_id: int,
    category_id: int,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_category_stats(portfolio_id, category_id, currency=currency)


# --- Portfolio Asset Data ---


@router.get('/{portfolio_id}/asset/{asset_id}/returns', tags=['Portfolio Asset Data'])
async def get_asset_returns(
    portfolio_id: int,
    asset_id: int,
    start_date: str = None,
    end_date: str = None,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    asset_returns = await service.get_asset_acc_returns(portfolio_id, [asset_id], start_date, end_date, currency=currency)
    if asset_returns is None:
        return []
    return df_response(asset_returns)


@router.get('/{portfolio_id}/asset/{asset_id}/details', tags=['Portfolio Asset Data'], response_model=AssetDetailsWithPosition)
async def get_asset_details(
    portfolio_id: int,
    asset_id: int,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_asset_details(portfolio_id, asset_id, currency=currency)


@router.get('/{portfolio_id}/asset/{asset_id}/analysis', tags=['Portfolio Asset Data'])
async def get_asset_analysis(
    portfolio_id: int,
    asset_id: int,
    currency: str = Query('BRL'),
    session=Depends(get_session),
):
    service = PortfolioPositionService(session)
    return await service.get_asset_analysis(portfolio_id, asset_id, currency=currency)