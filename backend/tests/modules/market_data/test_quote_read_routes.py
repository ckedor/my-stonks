from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.composition.market_data import (
    get_on_demand_quote_read_service,
    get_persisted_quote_read_service,
)
from app.modules.market_data.api.quote.router import router

HTTP_OK = 200


@pytest.mark.asyncio
async def test_persisted_route_delegates_database_query_to_read_service():
    service = SimpleNamespace(get_quotes=AsyncMock(return_value=[]))
    app = FastAPI()
    app.include_router(router, prefix='/market_data')
    app.dependency_overrides[get_persisted_quote_read_service] = lambda: service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        response = await client.get(
            '/market_data/quotes/persisted',
            params=[('asset_ids', '7'), ('asset_ids', '8')],
        )

    assert response.status_code == HTTP_OK
    service.get_quotes.assert_awaited_once()
    assert service.get_quotes.await_args.kwargs['asset_ids'] == [7, 8]


@pytest.mark.asyncio
async def test_on_demand_route_delegates_without_storage_dependencies():
    payload = {
        'ticker': 'PETR4',
        'asset_type_id': 4,
        'currency': 'BRL',
        'logo_url': 'https://icons.brapi.dev/icons/PETR4.svg',
        'quotes': [],
    }
    service = SimpleNamespace(get_quotes=AsyncMock(return_value=payload))
    app = FastAPI()
    app.include_router(router, prefix='/market_data')
    app.dependency_overrides[get_on_demand_quote_read_service] = lambda: service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        response = await client.get(
            '/market_data/quotes/on-demand',
            params={'ticker': 'PETR4', 'asset_type_id': 4},
        )

    assert response.status_code == HTTP_OK
    assert response.json() == payload
    service.get_quotes.assert_awaited_once()
