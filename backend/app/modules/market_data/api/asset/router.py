"""Asset, asset type, FII/ETF, fixed income, treasury bond, event and exchange routes."""

from typing import List

from app.infra.db.session import get_session
from app.modules.market_data.api.asset.schemas import (
    AssetCreate,
    AssetDetailsOut,
    AssetEvent,
    AssetType,
    AssetUpdate,
    ExchangeOut,
    FixedIncomeAsset,
    FixedIncomeType,
    TreasuryBondTypeOut,
)
from app.modules.market_data.service.asset_service import AssetService
from app.modules.users.views import current_superuser
from fastapi import APIRouter, Depends

router = APIRouter(prefix='/assets', tags=['Assets'])


@router.get('/assets')
async def list_assets(
    session=Depends(get_session),
):
    """List all assets (cached for 24h)"""
    service = AssetService(session)
    return await service.list_assets()


@router.delete('/assets/{asset_id}')
async def delete_asset(
    asset_id: int,
    session=Depends(get_session),
):
    """Delete an asset by ID"""
    service = AssetService(session)
    return await service.delete_asset(asset_id)


@router.get('/assets/{asset_id}', response_model=AssetDetailsOut)
async def get_asset(
    asset_id: int,
    session=Depends(get_session),
):
    """Get a single asset with all details"""
    service = AssetService(session)
    return await service.get_asset(asset_id)


@router.post('/asset')
async def create_asset(
    data: AssetCreate,
    session=Depends(get_session),
):
    """Create a new asset with subclass data"""
    service = AssetService(session)
    return await service.create_asset(data.model_dump())


@router.put('/asset/{asset_id}')
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    session=Depends(get_session),
):
    """Update an asset with subclass data"""
    service = AssetService(session)
    return await service.update_asset({**data.model_dump(), 'id': asset_id})


@router.get('/types', response_model=List[AssetType])
async def list_asset_types(
    session=Depends(get_session),
):
    """List all asset types"""
    service = AssetService(session)
    return await service.list_asset_types()


@router.post('/fixed_income')
async def create_fixed_income(
    fixed_income: FixedIncomeAsset,
    session=Depends(get_session),
):
    """Create a new fixed income asset"""
    service = AssetService(session)
    return await service.create_fixed_income(fixed_income.model_dump())


@router.get('/fixed_income/types', response_model=List[FixedIncomeType])
async def list_fixed_income_types(
    session=Depends(get_session),
):
    """List all fixed income types"""
    service = AssetService(session)
    return await service.list_fixed_income_types()


@router.get('/fiis/segments')
async def get_segments(
    session=Depends(get_session),
):
    """Get FII segments"""
    service = AssetService(session)
    return await service.list_fii_segments()


@router.get(
    '/events',
    response_model=List[AssetEvent],
    dependencies=[Depends(current_superuser)],
)
async def list_events(
    session=Depends(get_session),
):
    """List all asset events"""
    service = AssetService(session)
    return await service.list_events()


@router.post('/event', dependencies=[Depends(current_superuser)])
async def create_event(
    event: AssetEvent,
    session=Depends(get_session),
):
    """Create a new asset event"""
    service = AssetService(session)
    return await service.create_event(event)


@router.put('/event', dependencies=[Depends(current_superuser)])
async def update_event(
    event: AssetEvent,
    session=Depends(get_session),
):
    """Update an asset event"""
    service = AssetService(session)
    return await service.update_event(event)


@router.delete('/event/{event_id}', dependencies=[Depends(current_superuser)])
async def delete_event(
    event_id: int,
    session=Depends(get_session),
):
    """Delete an asset event"""
    service = AssetService(session)
    await service.delete_event(event_id)
    return {'message': 'OK'}


@router.get('/exchanges', response_model=List[ExchangeOut])
async def list_exchanges(
    session=Depends(get_session),
):
    """List all exchanges"""
    service = AssetService(session)
    return await service.list_exchanges()


@router.get('/etfs/segments')
async def list_etf_segments(
    session=Depends(get_session),
):
    """List all ETF segments"""
    service = AssetService(session)
    return await service.list_etf_segments()


@router.get('/treasury_bond/types', response_model=List[TreasuryBondTypeOut])
async def list_treasury_bond_types(
    session=Depends(get_session),
):
    """List all treasury bond types"""
    service = AssetService(session)
    return await service.list_treasury_bond_types()


@router.get('/indexes')
async def list_indexes(
    session=Depends(get_session),
):
    """List all indexes (for fixed income reference)"""
    service = AssetService(session)
    return await service.list_indexes()
