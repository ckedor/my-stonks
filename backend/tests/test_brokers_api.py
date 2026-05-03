# tests/test_brokers_api.py
"""
E2E tests for the Brokers API.
Covers full request → route → service → DB → response flow.
"""

from http import HTTPStatus

import pytest
from app.infra.db.models.portfolio import Broker


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _create_broker(client, name='XP Investimentos', cnpj='02.332.886/0001-04', currency_id=1):
    """Helper to create a broker and return the response."""
    payload = {'name': name, 'cnpj': cnpj, 'currency_id': currency_id}
    return await client.post('/market_data/broker', json=payload)


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_broker(client):
    response = await _create_broker(client)

    assert response.status_code == HTTPStatus.CREATED
    data = response.json()
    assert data['name'] == 'XP Investimentos'
    assert data['cnpj'] == '02.332.886/0001-04'
    assert data['currency']['id'] == 1
    assert 'id' in data


@pytest.mark.asyncio
async def test_create_broker_without_cnpj(client):
    payload = {'name': 'Broker Sem CNPJ', 'currency_id': 1}
    response = await client.post('/market_data/broker', json=payload)

    assert response.status_code == HTTPStatus.CREATED
    data = response.json()
    assert data['name'] == 'Broker Sem CNPJ'
    assert data['cnpj'] is None


@pytest.mark.asyncio
async def test_create_broker_duplicate_cnpj(client):
    await _create_broker(client, name='Broker A', cnpj='11.111.111/0001-11')
    response = await _create_broker(client, name='Broker B', cnpj='11.111.111/0001-11')

    assert response.status_code == HTTPStatus.BAD_REQUEST


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_brokers_empty(client):
    response = await client.get('/market_data/broker')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_brokers_returns_created(client):
    await _create_broker(client, name='Broker 1', cnpj='11.111.111/0001-11')
    await _create_broker(client, name='Broker 2', cnpj='22.222.222/0001-22')

    response = await client.get('/market_data/broker')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) == 2
    names = {b['name'] for b in data}
    assert names == {'Broker 1', 'Broker 2'}


# ---------------------------------------------------------------------------
# GET by ID
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_broker_by_id(client):
    create_resp = await _create_broker(client)
    broker_id = create_resp.json()['id']

    response = await client.get(f'/market_data/broker/{broker_id}')

    assert response.status_code == HTTPStatus.OK
    assert response.json()['id'] == broker_id


@pytest.mark.asyncio
async def test_get_broker_not_found(client):
    response = await client.get('/market_data/broker/99999')

    assert response.status_code == HTTPStatus.NOT_FOUND


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_update_broker(client):
    create_resp = await _create_broker(client)
    broker_id = create_resp.json()['id']

    update_payload = {'name': 'Novo Nome', 'cnpj': None, 'currency_id': 2}
    response = await client.put(f'/market_data/broker/{broker_id}', json=update_payload)

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data['name'] == 'Novo Nome'
    assert data['currency']['id'] == 2


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_delete_broker(client):
    create_resp = await _create_broker(client)
    broker_id = create_resp.json()['id']

    delete_resp = await client.delete(f'/market_data/broker/{broker_id}')
    assert delete_resp.status_code == HTTPStatus.NO_CONTENT

    # Verify it's gone
    get_resp = await client.get(f'/market_data/broker/{broker_id}')
    assert get_resp.status_code == HTTPStatus.NOT_FOUND


# ---------------------------------------------------------------------------
# DB verification
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_create_broker_persists_in_db(client, db):
    await _create_broker(client, name='Persistência', cnpj='33.333.333/0001-33')

    broker = db.query(Broker).filter_by(cnpj='33.333.333/0001-33').first()
    assert broker is not None
    assert broker.name == 'Persistência'
