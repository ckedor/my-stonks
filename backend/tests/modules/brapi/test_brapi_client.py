from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from app.infra.integrations.brapi_client import BrapiClient
from app.modules.brapi.api import router
from app.modules.brapi.service import BrapiService
from fastapi.routing import APIRoute


def test_every_api_endpoint_has_an_explicit_service_and_client_method():
    method_names = {
        route.name
        for route in router.routes
        if isinstance(route, APIRoute)
    }

    for method_name in method_names:
        assert callable(getattr(BrapiService, method_name))
        assert callable(getattr(BrapiClient, method_name))


@pytest.mark.asyncio
async def test_client_method_uses_fixed_url_and_forwards_params_unchanged():
    client = BrapiClient()
    client._get = AsyncMock(return_value={'results': []})
    params = {
        'symbols': ['HGLG11', 'MXRF11'],
        'allVersions': False,
        'referenceDate': None,
    }

    result = await client.get_fii_portfolio(**params)

    assert result == {'results': []}
    client._get.assert_awaited_once_with('/v2/fii/portfolio', params)


@pytest.mark.asyncio
async def test_service_calls_client_with_explicit_upstream_parameter_names():
    client = SimpleNamespace(
        get_stock_historical=AsyncMock(return_value={'results': []}),
        aclose=AsyncMock(),
    )
    service = BrapiService(client)

    result = await service.get_stock_historical(
        symbols='PETR4,VALE3',
        range='1y',
        interval='1d',
        start_date='2024-01-01',
        end_date='2024-12-31',
        sort_order='asc',
    )

    assert result == {'results': []}
    client.get_stock_historical.assert_awaited_once_with(
        symbols='PETR4,VALE3',
        range='1y',
        interval='1d',
        startDate='2024-01-01',
        endDate='2024-12-31',
        sortOrder='asc',
    )


@pytest.mark.asyncio
async def test_service_closes_its_client():
    client = SimpleNamespace(aclose=AsyncMock())
    service = BrapiService(client)

    await service.aclose()

    client.aclose.assert_awaited_once_with()
