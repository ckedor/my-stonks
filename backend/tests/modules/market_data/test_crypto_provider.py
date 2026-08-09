from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.infra.exceptions import IntegrationRateLimited
from app.infra.integrations.brapi_client import BrapiClient
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider

EXPECTED_CRYPTO_CLOSE = 100_000


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


def crypto_history_df() -> pd.DataFrame:
    return pd.DataFrame([
        {
            'date': pd.Timestamp('2025-01-01'),
            'open': 99_000,
            'high': 101_000,
            'low': 98_000,
            'close': EXPECTED_CRYPTO_CLOSE,
            'volume': 120,
            'currency': 'USD',
        }
    ])


@pytest.mark.asyncio
async def test_crypto_uses_crypto_compare_for_its_deeper_history():
    """Brapi caps crypto at 1000 daily points, which leaves older positions
    unpriced, so CryptoCompare is the source."""
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.crypto_compare_client = SimpleNamespace(
        get_crypto_quotes_df=AsyncMock(return_value=crypto_history_df()),
    )
    provider.brapi_client = SimpleNamespace(get_crypto_quotes=AsyncMock())

    result = await provider._fetch_crypto_quotes(ticker='BTC', start_date=None, exchange=None)

    assert result.ticker == 'BTC'
    assert result.currency == 'USD'
    assert result.source == 'cryptocompare'
    assert result.quotes[0].close == EXPECTED_CRYPTO_CLOSE
    provider.crypto_compare_client.get_crypto_quotes_df.assert_awaited_once()
    provider.brapi_client.get_crypto_quotes.assert_not_awaited()


@pytest.mark.asyncio
async def test_crypto_forwards_the_requested_start_date():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.crypto_compare_client = SimpleNamespace(
        get_crypto_quotes_df=AsyncMock(return_value=crypto_history_df()),
    )

    await provider._fetch_crypto_quotes(
        ticker='BTC',
        start_date=date(2025, 1, 1),
        exchange=None,
    )

    _, kwargs = provider.crypto_compare_client.get_crypto_quotes_df.await_args
    # The client compares against API timestamps, so it needs a datetime.
    assert isinstance(kwargs['init_date'], datetime)
    assert kwargs['init_date'].date() == date(2025, 1, 1)


@pytest.mark.asyncio
async def test_crypto_falls_back_to_brapi_when_the_deep_provider_refuses():
    """CryptoCompare's free tier is metered, so a refusal must not leave the
    screen empty when brapi can still answer with a shorter history."""
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.crypto_compare_client = SimpleNamespace(
        get_crypto_quotes_df=AsyncMock(
            side_effect=IntegrationRateLimited(provider='cryptocompare'),
        ),
    )
    provider.brapi_client = SimpleNamespace(
        get_crypto_quotes=AsyncMock(
            return_value={
                'currency': 'USD',
                'quotes': [{'date': '2025-01-01', 'close': EXPECTED_CRYPTO_CLOSE}],
            }
        ),
    )
    provider._fetch_crypto_logo = AsyncMock(return_value=None)

    result = await provider._fetch_crypto_quotes(
        ticker='BTC',
        start_date=date(2025, 1, 1),
        exchange=None,
    )

    assert result.source == 'brapi'
    assert result.currency == 'USD'
    assert result.quotes[0].close == EXPECTED_CRYPTO_CLOSE
    provider.brapi_client.get_crypto_quotes.assert_awaited_once()


@pytest.mark.asyncio
async def test_crypto_does_not_call_the_fallback_when_the_deep_provider_answers():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.crypto_compare_client = SimpleNamespace(
        get_crypto_quotes_df=AsyncMock(return_value=crypto_history_df()),
    )
    provider.brapi_client = SimpleNamespace(get_crypto_quotes=AsyncMock())
    provider._fetch_crypto_logo = AsyncMock(return_value=None)

    result = await provider._fetch_crypto_quotes(ticker='BTC', start_date=None, exchange=None)

    assert result.source == 'cryptocompare'
    provider.brapi_client.get_crypto_quotes.assert_not_awaited()
