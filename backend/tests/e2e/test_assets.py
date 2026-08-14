# tests/test_asset_api.py
"""
E2E tests for the Asset API.
Covers asset listing, types, fixed income CRUD, events, and FII segments.
"""

from http import HTTPStatus

from sqlalchemy import select

from app.modules.market_data.domain.assets import Asset, Event, FixedIncome


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class _Row:
    def __init__(self, id):
        self.id = id


async def _seed_asset(factory, ticker='PETR4', name='Petrobras'):
    """One asset row, with the reference ids looked up rather than hardcoded."""
    return _Row(await factory.asset(ticker=ticker, name=name))


# ---------------------------------------------------------------------------
# LIST ASSETS
# ---------------------------------------------------------------------------
async def test_list_assets_empty(client):
    response = await client.get('/market_data/asset')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


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
async def test_delete_asset(client, db, factory):
    asset = await _seed_asset(factory)

    response = await client.delete(f'/market_data/asset/{asset.id}')

    assert response.status_code == HTTPStatus.OK

    # Verify deleted from DB
    remaining = await db.scalar(select(Asset).filter_by(id=asset.id))
    assert remaining is None


# ---------------------------------------------------------------------------
# ASSET TYPES (reference data from migrations)
# ---------------------------------------------------------------------------
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
async def test_create_fixed_income(client, db):
    payload = {
        'name': 'CDB Banco Inter',
        'ticker': 'CDB-INTER',
        'maturity_date': '2027-01-15',
        'fee': 12.5,
        'index_id': None,
        'fixed_income_type_id': 1,  # Prefixado
        'asset_type_id': 8,  # CDB
    }

    response = await client.post('/market_data/asset/fixed_income', json=payload)

    assert response.status_code == HTTPStatus.OK

    # Verify in DB
    asset = await db.scalar(select(Asset).filter_by(ticker='CDB-INTER'))
    assert asset is not None
    assert asset.name == 'CDB Banco Inter'

    fi = await db.scalar(select(FixedIncome).filter_by(asset_id=asset.id))
    assert fi is not None
    assert float(fi.fee) == 12.5


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
async def test_list_fii_segments(client):
    response = await client.get('/market_data/asset/fii/segment')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 1


# ---------------------------------------------------------------------------
# EVENTS
# ---------------------------------------------------------------------------
async def test_list_events_empty(client):
    response = await client.get('/market_data/asset/event')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


async def test_create_event(client, db, factory):
    asset = await _seed_asset(factory)

    payload = {
        'id': None,
        'asset_id': asset.id,
        'date': '2025-06-01',
        'factor': 2.0,
        'type': 'SPLIT',
    }
    response = await client.post('/market_data/asset/event', json=payload)

    assert response.status_code == HTTPStatus.OK

    event = await db.scalar(select(Event).filter_by(asset_id=asset.id))
    assert event is not None
    assert event.type == 'SPLIT'
    assert float(event.factor) == 2.0


async def test_create_and_list_events(client, db, factory):
    asset = await _seed_asset(factory)

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


async def test_update_event(client, db, factory):
    asset = await _seed_asset(factory)

    # Create
    create_payload = {
        'id': None,
        'asset_id': asset.id,
        'date': '2025-06-01',
        'factor': 2.0,
        'type': 'SPLIT',
    }
    await client.post('/market_data/asset/event', json=create_payload)

    event = await db.scalar(select(Event).filter_by(asset_id=asset.id))
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
    updated = await db.scalar(select(Event).filter_by(id=event.id))
    assert float(updated.factor) == 3.0
