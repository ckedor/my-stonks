# tests/test_asset_api.py
"""
E2E tests for the Asset API.
Covers asset listing, types, fixed income CRUD, events, and FII segments.
"""

from datetime import date
from http import HTTPStatus

import pytest
from app.infra.db.models.asset import Asset, AssetType, Event
from app.infra.db.models.asset_fixed_income import FixedIncome


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _seed_asset(db, ticker='PETR4', name='Petrobras', asset_type_id=4, exchange_id=4):
    """Insert an asset directly into the DB for tests that need pre-existing data."""
    asset = Asset(
        ticker=ticker,
        name=name,
        asset_type_id=asset_type_id,
        exchange_id=exchange_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


# ---------------------------------------------------------------------------
# LIST ASSETS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_assets_empty(client):
    response = await client.get('/market_data/asset')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_assets_returns_seeded(client, db):
    _seed_asset(db)

    response = await client.get('/market_data/asset')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 1
    tickers = [a['ticker'] for a in data]
    assert 'PETR4' in tickers


# ---------------------------------------------------------------------------
# DELETE ASSET
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_delete_asset(client, db):
    asset = _seed_asset(db)

    response = await client.delete(f'/market_data/asset/{asset.id}')

    assert response.status_code == HTTPStatus.OK

    # Verify deleted from DB
    remaining = db.query(Asset).filter_by(id=asset.id).first()
    assert remaining is None


# ---------------------------------------------------------------------------
# ASSET TYPES (reference data from migrations)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_asset_types(client):
    response = await client.get('/market_data/asset/type')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 13  # from seed migration
    short_names = {t['short_name'] for t in data}
    assert {'ETF', 'FII', 'Ação', 'CDB'}.issubset(short_names)


# ---------------------------------------------------------------------------
# FIXED INCOME
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_fixed_income(client, db):
    payload = {
        'name': 'CDB Banco Inter',
        'ticker': 'CDB-INTER',
        'maturity_date': '2027-01-15',
        'fee': 12.5,
        'index_id': None,
        'fixed_income_type_id': 1,  # Prefixado
        'asset_type_id': 8,          # CDB
    }

    response = await client.post('/market_data/asset/fixed_income', json=payload)

    assert response.status_code == HTTPStatus.OK

    # Verify in DB
    asset = db.query(Asset).filter_by(ticker='CDB-INTER').first()
    assert asset is not None
    assert asset.name == 'CDB Banco Inter'

    fi = db.query(FixedIncome).filter_by(asset_id=asset.id).first()
    assert fi is not None
    assert float(fi.fee) == 12.5


@pytest.mark.asyncio
async def test_list_fixed_income_types(client):
    response = await client.get('/market_data/asset/fixed_income/type')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 3
    names = {t['name'] for t in data}
    assert 'Prefixado' in names


# ---------------------------------------------------------------------------
# FII SEGMENTS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_fii_segments(client):
    response = await client.get('/market_data/asset/fii/segment')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 1


# ---------------------------------------------------------------------------
# EVENTS
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_events_empty(client):
    response = await client.get('/market_data/asset/event')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_event(client, db):
    asset = _seed_asset(db)

    payload = {
        'id': None,
        'asset_id': asset.id,
        'date': '2025-06-01',
        'factor': 2.0,
        'type': 'SPLIT',
    }
    response = await client.post('/market_data/asset/event', json=payload)

    assert response.status_code == HTTPStatus.OK

    event = db.query(Event).filter_by(asset_id=asset.id).first()
    assert event is not None
    assert event.type == 'SPLIT'
    assert float(event.factor) == 2.0


@pytest.mark.asyncio
async def test_create_and_list_events(client, db):
    asset = _seed_asset(db)

    payload = {
        'id': None,
        'asset_id': asset.id,
        'date': '2025-06-01',
        'factor': 2.0,
        'type': 'SPLIT',
    }
    await client.post('/market_data/asset/event', json=payload)

    response = await client.get('/market_data/asset/event')
    data = response.json()
    assert len(data) == 1
    assert data[0]['type'] == 'SPLIT'


@pytest.mark.asyncio
async def test_update_event(client, db):
    asset = _seed_asset(db)

    # Create
    create_payload = {
        'id': None,
        'asset_id': asset.id,
        'date': '2025-06-01',
        'factor': 2.0,
        'type': 'SPLIT',
    }
    await client.post('/market_data/asset/event', json=create_payload)

    event = db.query(Event).filter_by(asset_id=asset.id).first()
    assert event is not None

    # Update
    update_payload = {
        'id': event.id,
        'asset_id': asset.id,
        'date': '2025-07-01',
        'factor': 3.0,
        'type': 'SPLIT',
    }
    response = await client.put(f'/market_data/asset/event/{event.id}', json=update_payload)
    assert response.status_code == HTTPStatus.OK

    db.expire_all()
    updated = db.query(Event).filter_by(id=event.id).first()
    assert float(updated.factor) == 3.0
