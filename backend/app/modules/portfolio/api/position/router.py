import datetime as dt

from fastapi import APIRouter, Depends, Query

from app.composition.portfolio import get_portfolio_position_service
from app.lib.utils.fastapi import df_response
from app.modules.market_data.api.asset.schemas import (
    AssetDetailsOut,
    AssetDetailsWithPosition,
)
from app.modules.portfolio.domain.portfolio_segment import PortfolioSegment
from app.modules.portfolio.service.portfolio_position_service import (
    PortfolioPositionService,
)

router = APIRouter(prefix='/position', tags=['Portfolio Position'])


@router.get('/{portfolio_id}')
async def get_portfolio_position(  # noqa: PLR0913
    portfolio_id: int,
    most_recent: bool = Query(True),
    group_by_broker: bool = Query(False),
    asset_id: int = Query(None),
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    if most_recent:
        return await service.get_portfolio_position(
            portfolio_id, group_by_broker=group_by_broker, currency=currency
        )
    return await service.get_portfolio_position_history(portfolio_id, asset_id, currency=currency)


@router.get('/{portfolio_id}/returns')
async def get_portfolio_returns(
    portfolio_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_portfolio_returns(portfolio_id, currency)


@router.get('/{portfolio_id}/asset-type/{asset_type_id}/returns')
async def get_asset_type_returns(
    portfolio_id: int,
    asset_type_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_asset_type_returns(portfolio_id, asset_type_id, currency)


@router.get('/{portfolio_id}/asset-type/{asset_type_id}/analysis')
async def get_asset_type_analysis(
    portfolio_id: int,
    asset_type_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_asset_type_stats(portfolio_id, asset_type_id, currency)


@router.get('/{portfolio_id}/segment/{segment}/returns')
async def get_segment_returns(
    portfolio_id: int,
    segment: PortfolioSegment,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_segment_returns(portfolio_id, segment, currency)


@router.get('/{portfolio_id}/segment/{segment}/analysis')
async def get_segment_analysis(
    portfolio_id: int,
    segment: PortfolioSegment,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_segment_stats(portfolio_id, segment, currency)


@router.get('/{portfolio_id}/patrimony_evolution')
async def get_patrimony_evolution(  # noqa: PLR0913
    portfolio_id: int,
    asset_id: int = Query(None),
    asset_type_id: int = Query(None),
    asset_type_ids: list[int] | None = Query(None),
    segment: PortfolioSegment | None = Query(None),
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_patrimony_evolution(
        portfolio_id, asset_id, asset_type_id, asset_type_ids, currency=currency, segment=segment
    )


@router.get('/{portfolio_id}/analysis')
async def get_portfolio_analysis(
    portfolio_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_portfolio_stats(portfolio_id, currency=currency)


@router.get('/{portfolio_id}/category/returns')
async def get_category_returns(
    portfolio_id: int,
    category_id: int = Query(None),
    most_recent: bool = Query(False),
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_category_returns(portfolio_id, category_id, most_recent, currency)


@router.get('/{portfolio_id}/category/{category_id}/analysis')
async def get_category_analysis(
    portfolio_id: int,
    category_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_category_stats(portfolio_id, category_id, currency=currency)


@router.get('/{portfolio_id}/asset/{asset_id}/returns')
async def get_asset_returns(  # noqa: PLR0913
    portfolio_id: int,
    asset_id: int,
    # Datas, e não texto: o repositório compara a coluna `date` direto, e o
    # Postgres não compara `date` com `varchar` -- estes dois parâmetros
    # devolviam 500 sempre que preenchidos. Mesma anotação que o módulo de
    # dividendos já usa.
    start_date: dt.date | None = None,
    end_date: dt.date | None = None,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    asset_returns = await service.get_asset_acc_returns(
        portfolio_id, [asset_id], start_date, end_date, currency=currency
    )
    if asset_returns is None:
        return []
    return df_response(asset_returns)


@router.get('/{portfolio_id}/asset/{asset_id}/details', response_model=AssetDetailsWithPosition)
async def get_asset_details(
    portfolio_id: int,
    asset_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    held = await service.get_asset_details(portfolio_id, asset_id, currency=currency)
    return AssetDetailsWithPosition(
        **AssetDetailsOut.model_validate(held.asset).model_dump(),
        quantity=held.quantity,
        price=held.price,
        average_price=held.average_price,
        value=held.value,
        acc_return=held.acc_return,
        twelve_months_return=held.twelve_months_return,
        cagr=held.cagr,
    )


@router.get('/{portfolio_id}/asset/{asset_id}/analysis')
async def get_asset_analysis(
    portfolio_id: int,
    asset_id: int,
    currency: str = Query('BRL'),
    service: PortfolioPositionService = Depends(get_portfolio_position_service),
):
    return await service.get_asset_analysis(portfolio_id, asset_id, currency=currency)
