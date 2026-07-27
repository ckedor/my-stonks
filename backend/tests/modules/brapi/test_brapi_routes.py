from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from app.modules.brapi.api import router
from app.modules.brapi.api.stocks.schemas import StockHistoricalQuery
from app.modules.brapi.service import get_brapi_service
from fastapi import FastAPI
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

EXPECTED_V2_ENDPOINT_COUNT = 71
EXPECTED_V2_QUERY_PARAMETER_COUNT = 319
EXPECTED_BRAPI_GROUPS = {
    'Ações',
    'Câmbio',
    'Conta',
    'Criptomoedas',
    'Dicionário',
    'FIIs',
    'Fundos',
    'Futuros',
    'Inflação',
    'Macroeconomia',
    'Opções',
    'Opções sobre futuros',
    'Taxa de juros',
    'Tesouro Direto',
    'Tickers',
}


def test_router_exposes_explicit_routes_grouped_by_domain():
    routes = [
        route
        for route in router.routes
        if isinstance(route, APIRoute)
    ]

    assert len(routes) == EXPECTED_V2_ENDPOINT_COUNT
    assert len({route.path for route in routes}) == EXPECTED_V2_ENDPOINT_COUNT
    assert {tag for route in routes for tag in route.tags} == EXPECTED_BRAPI_GROUPS


def test_swagger_documents_explicit_query_schema_constraints_and_examples():
    app = FastAPI()
    app.include_router(router)
    openapi = app.openapi()
    operation = openapi['paths']['/brapi/v2/stocks/historical']['get']
    parameters = {parameter['name']: parameter for parameter in operation['parameters']}

    assert operation['summary'] == 'Histórico v2 de ações'
    assert operation['tags'] == ['Ações']
    assert parameters['symbols']['required'] is True
    assert parameters['symbols']['schema']['examples'] == ['PETR4,VALE3']
    assert parameters['startDate']['schema']['examples'] == ['2024-01-01']
    assert parameters['range']['schema']['anyOf'][0]['enum'] == [
        '1d',
        '2d',
        '5d',
        '7d',
        '1mo',
        '3mo',
        '6mo',
        '1y',
        '2y',
        '5y',
        '10y',
        'ytd',
        'max',
    ]
    assert 'GET /brapi/v2/stocks/historical?' in operation['description']
    assert sum(
        len(path_item['get'].get('parameters', []))
        for path, path_item in openapi['paths'].items()
        if path.startswith('/brapi/v2')
    ) == EXPECTED_V2_QUERY_PARAMETER_COUNT


def test_query_schema_validates_required_fields_enums_and_extra_params():
    with pytest.raises(ValidationError):
        StockHistoricalQuery(range='invalid')

    with pytest.raises(ValidationError):
        StockHistoricalQuery(symbols='PETR4', unexpected='value')


@pytest.mark.asyncio
async def test_route_calls_service_instead_of_infrastructure():
    service = SimpleNamespace(
        get_stock_historical=AsyncMock(return_value={'results': []}),
    )

    async def override_service():
        return service

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_brapi_service] = override_service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        response = await client.get(
            '/brapi/v2/stocks/historical',
            params={
                'symbols': 'PETR4,VALE3',
                'startDate': '2024-01-01',
                'sortOrder': 'asc',
            },
        )

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'results': []}
    service.get_stock_historical.assert_awaited_once_with(
        symbols='PETR4,VALE3',
        range=None,
        interval=None,
        start_date='2024-01-01',
        end_date=None,
        sort_order='asc',
    )


def test_api_layer_has_no_direct_infrastructure_or_dynamic_route_generation():
    api_root = Path('app/modules/brapi/api')
    python_sources = {
        path: path.read_text()
        for path in api_root.rglob('*.py')
    }

    assert all(
        'app.infra' not in source
        for source in python_sources.values()
    )
    combined_source = '\n'.join(python_sources.values())
    assert 'create_model' not in combined_source
    assert 'TYPE_MAP' not in combined_source
    assert 'add_api_route' not in combined_source
    assert 'getattr(' not in combined_source
