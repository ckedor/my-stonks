from http import HTTPStatus

import pytest
from httpx import ASGITransport, AsyncClient

from app.entrypoints.http.fastapi_app import create_app
from app.entrypoints.http.module_docs import MODULE_DOCS, build_module_openapi


def test_module_openapi_schemas_partition_all_application_paths():
    app = create_app()
    complete_paths = set(app.openapi()['paths'])
    module_path_sets = []

    for module in MODULE_DOCS:
        schema = build_module_openapi(app, module)
        module_paths = set(schema['paths'])
        module_path_sets.append(module_paths)

        assert module_paths
        assert all(module.includes(path) for path in module_paths)
        assert schema['info']['title'] == f'{app.title} — {module.title}'

    assert set().union(*module_path_sets) == complete_paths
    assert sum(map(len, module_path_sets)) == len(complete_paths)


@pytest.mark.asyncio
async def test_module_swagger_page_uses_its_filtered_openapi_schema():
    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        docs_response = await client.get('/docs/market-data')
        portfolio_docs_response = await client.get('/docs/portfolio')
        schema_response = await client.get('/openapi/market-data.json')
        complete_docs_response = await client.get('/docs')
        module_index_response = await client.get('/docs/modules')

    assert docs_response.status_code == HTTPStatus.OK
    assert '/openapi/market-data.json' in docs_response.text
    assert 'class="module-docs-nav"' in docs_response.text
    assert 'href="/docs/market-data" aria-current="page"' in docs_response.text
    assert 'href="/docs/portfolio"' in docs_response.text
    assert 'background: #fafafa' in docs_response.text
    assert 'color: #3b4151' in docs_response.text
    assert 'background: #111827' not in docs_response.text
    assert docs_response.text.count('class="module-docs-nav__link"') == len(MODULE_DOCS) + 1

    assert portfolio_docs_response.status_code == HTTPStatus.OK
    assert 'href="/docs/portfolio" aria-current="page"' in portfolio_docs_response.text

    assert schema_response.status_code == HTTPStatus.OK
    assert all(path.startswith('/market_data/') for path in schema_response.json()['paths'])
    assert complete_docs_response.status_code == HTTPStatus.OK
    assert 'href="/docs" aria-current="page"' in complete_docs_response.text
    assert f"url: '{app.openapi_url}'" in complete_docs_response.text
    assert module_index_response.status_code == HTTPStatus.OK
    assert '/docs/portfolio' in module_index_response.text
    assert '/docs/market-data' in module_index_response.text
