import logging

import httpx
import pytest

from app.infra.exceptions import IntegrationError
from app.infra.http import AsyncHttpClient


@pytest.mark.asyncio
async def test_omits_none_query_parameters_without_changing_values():
    requested_urls: list[httpx.URL] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        requested_urls.append(request.url)
        return httpx.Response(
            status_code=200,
            json={'results': []},
            request=request,
        )

    client = AsyncHttpClient(
        provider='brapi',
        base_url='https://brapi.dev/api',
        max_retries=0,
    )
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=httpx.MockTransport(handle_request),
    )

    result = await client.get(
        '/v2/funds/indicators',
        params={
            'symbols': 'HABT11',
            'cnpjs': None,
            'assetType': None,
        },
    )

    await client.aclose()

    assert result == {'results': []}
    assert requested_urls == [
        httpx.URL('https://brapi.dev/api/v2/funds/indicators?symbols=HABT11'),
    ]


@pytest.mark.asyncio
async def test_logs_response_text_for_http_errors(caplog):
    def handle_request(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=400,
            json={'error': 'symbols is required'},
            request=request,
        )

    client = AsyncHttpClient(
        provider='brapi',
        base_url='https://brapi.dev/api',
        max_retries=0,
    )
    client._client = httpx.AsyncClient(
        base_url=client.base_url,
        transport=httpx.MockTransport(handle_request),
    )

    with caplog.at_level(logging.ERROR, logger='my-stonks'), pytest.raises(IntegrationError):
        await client.get('/v2/stocks/financial-data', params={'symbols': 'INVALID'})

    await client.aclose()

    assert (
        'Integration request failed: provider=brapi method=GET '
        'url=https://brapi.dev/api/v2/stocks/financial-data status=400 '
        'response={"error":"symbols is required"}'
    ) in caplog.messages
