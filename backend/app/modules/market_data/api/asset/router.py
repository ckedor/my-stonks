"""Asset, asset type, FII/ETF, fixed income, treasury bond, event and exchange routes."""

from typing import List

from fastapi import APIRouter, Depends

from app.composition.market_data import get_asset_read_service, get_asset_write_service
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

router = APIRouter(prefix='/asset', tags=['Asset'])


# ---------------------------------------------------------------------------
# Auxiliary listings (declared first to avoid clashing with /{asset_id})
# ---------------------------------------------------------------------------
@router.get('/type', response_model=List[AssetType])
async def list_asset_types(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all asset types."""
    return await service.list_asset_types()


@router.post('/fixed_income')
async def create_fixed_income(
    fixed_income: FixedIncomeAsset,
    service: AssetService = Depends(get_asset_write_service),
):
    """Create a new fixed income asset."""
    return await service.create_fixed_income(fixed_income.model_dump())


@router.get('/fixed_income/type', response_model=List[FixedIncomeType])
async def list_fixed_income_types(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all fixed income types."""
    return await service.list_fixed_income_types()


@router.get('/fii/segment')
async def list_fii_segments(
    service: AssetService = Depends(get_asset_read_service),
):
    """List FII segments."""
    return await service.list_fii_segments()


@router.get('/etf/segment')
async def list_etf_segments(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all ETF segments."""
    return await service.list_etf_segments()


@router.get('/treasury_bond/type', response_model=List[TreasuryBondTypeOut])
async def list_treasury_bond_types(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all treasury bond types."""
    return await service.list_treasury_bond_types()


@router.get('/exchange', response_model=List[ExchangeOut])
async def list_exchanges(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all exchanges."""
    return await service.list_exchanges()


@router.get('/index')
async def list_indexes(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all indexes (for fixed income reference)."""
    return await service.list_indexes()


# ---------------------------------------------------------------------------
# Asset Event sub-resource
# ---------------------------------------------------------------------------
@router.get(
    '/event',
    response_model=List[AssetEvent],
    dependencies=[Depends(current_superuser)],
)
async def list_events(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all asset events."""
    return await service.list_events()


@router.post('/event', dependencies=[Depends(current_superuser)])
async def create_event(
    event: AssetEvent,
    service: AssetService = Depends(get_asset_write_service),
):
    """Create a new asset event."""
    return await service.create_event(event)


@router.put('/event/{event_id}', dependencies=[Depends(current_superuser)])
async def update_event(
    event_id: int,
    event: AssetEvent,
    service: AssetService = Depends(get_asset_write_service),
):
    """Update an asset event."""
    payload = event.model_copy(update={'id': event_id})
    return await service.update_event(payload)


@router.delete('/event/{event_id}', dependencies=[Depends(current_superuser)])
async def delete_event(
    event_id: int,
    service: AssetService = Depends(get_asset_write_service),
):
    """Delete an asset event."""
    await service.delete_event(event_id)
    return {'message': 'OK'}


# ---------------------------------------------------------------------------
# Asset CRUD
# ---------------------------------------------------------------------------
@router.get('')
async def list_assets(
    service: AssetService = Depends(get_asset_read_service),
):
    """List all assets (cached for 24h)."""
    return await service.list_assets()


@router.post('')
async def create_asset(
    data: AssetCreate,
    service: AssetService = Depends(get_asset_write_service),
):
    """Create a new asset with subclass data."""
    return await service.create_asset(data.model_dump())


@router.get('/{asset_id}', response_model=AssetDetailsOut)
async def get_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_read_service),
):
    """Get a single asset with all details."""
    return await service.get_asset(asset_id)


@router.put('/{asset_id}')
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    service: AssetService = Depends(get_asset_write_service),
):
    """Update an asset with subclass data."""
    return await service.update_asset({**data.model_dump(), 'id': asset_id})


@router.delete('/{asset_id}')
async def delete_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_write_service),
):
    """Delete an asset by ID."""
    return await service.delete_asset(asset_id)
