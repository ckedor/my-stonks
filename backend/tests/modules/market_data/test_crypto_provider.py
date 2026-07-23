from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.infra.exceptions import IntegrationRateLimited
from app.infra.integrations.brapi_client import BrapiClient
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider


@pytest.mark.asyncio
async def test_brapi_crypto_quotes_follow_documented_contract():
    client = BrapiClient()
    client._brapi_range_from_init_date = lambda _: '2y'
    client._get = AsyncMock(
        return_value={
            'coins': [
                {
                    'coin': 'BTC',
                    'currency': 'USD',
                    'historicalDataPrice': [
                        {
                            'date': 1735689600,
                            'open': 90_000,
                            'high': 95_000,
                            'low': 89_000,
                            'close': 94_000,
                            'volume': 100,
                            'adjustedClose': 94_000,
                        },
                        {
                            'date': 1735776000,
                            'open': 94_000,
                            'high': 97_000,
                            'low': 93_000,
                            'close': 96_000,
                            'volume': 120,
                            'adjustedClose': 96_000,
                        },
                    ],
                }
            ]
        }
    )

    result = await client.get_crypto_quotes(
        'btc',
        start_date='2025-01-02',
        end_date='2025-01-02',
    )

    client._get.assert_awaited_once_with(
        '/v2/crypto',
        {
            'coin': 'BTC',
            'currency': 'USD',
            'range': '2y',
            'interval': '1d',
        },
    )
    assert result['currency'] == 'USD'
    assert result['ticker'] == 'btc'
    assert result['quotes'] == [
        {
            'date': pd.Timestamp('2025-01-02'),
            'open': 94_000,
            'high': 97_000,
            'low': 93_000,
            'close': 96_000,
            'volume': 120,
        }
    ]

    await client.aclose()


@pytest.mark.asyncio
async def test_crypto_uses_brapi_as_primary_provider():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    expected = {'ticker': 'BTC', 'currency': 'USD', 'quotes': [{'close': 100_000}]}
    provider.brapi_client = SimpleNamespace(get_crypto_quotes=AsyncMock(return_value=expected))
    provider.crypto_compare_client = SimpleNamespace(get_quotes=AsyncMock())

    result = await provider._get_quotes_crypto('BTC', None, None)

    assert result == expected
    provider.brapi_client.get_crypto_quotes.assert_awaited_once()
    provider.crypto_compare_client.get_quotes.assert_not_awaited()


@pytest.mark.asyncio
async def test_crypto_falls_back_to_crypto_compare_when_brapi_is_rate_limited():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    fallback = {'ticker': 'BTC', 'currency': 'USD', 'quotes': [{'close': 99_000}]}
    provider.brapi_client = SimpleNamespace(
        get_crypto_quotes=AsyncMock(
            side_effect=IntegrationRateLimited(provider='brapi'),
        )
    )
    provider.crypto_compare_client = SimpleNamespace(
        get_quotes=AsyncMock(return_value=fallback),
    )

    result = await provider._get_quotes_crypto('BTC', '2025-01-01', '2025-01-31')

    assert result == fallback
    provider.crypto_compare_client.get_quotes.assert_awaited_once_with(
        'BTC',
        start_date='2025-01-01',
        end_date='2025-01-31',
    )
