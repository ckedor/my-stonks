# tests/test_market_data_api.py
"""E2E tests for the Market Data API."""

from datetime import date
from decimal import Decimal
from http import HTTPStatus
from unittest.mock import AsyncMock, patch

from sqlalchemy import text

from app.modules.market_data.domain.usd_brl import UsdBrlHistory, invert_rate

EXPECTED_CURRENCY_COUNT = 2
# USD/BRL is no longer one of them: it has its own table.
EXPECTED_SERIES_COUNT = 6
EXPECTED_INGESTION_TASK_COUNT = 2


# ---------------------------------------------------------------------------
# CURRENCIES (seeded by migration)
# ---------------------------------------------------------------------------
async def test_list_currencies(client):
    response = await client.get('/market_data/currency')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= EXPECTED_CURRENCY_COUNT
    codes = {c['code'] for c in data}
    assert {'BRL', 'USD'}.issubset(codes)


# ---------------------------------------------------------------------------
# INDEXES (seeded by migration)
# ---------------------------------------------------------------------------
async def test_list_indexes(client):
    response = await client.get('/market_data/series')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= EXPECTED_SERIES_COUNT
    short_names = {i['short_name'] for i in data}
    assert {'CDI', 'IBOVESPA', 'S&P500', 'IFIX'}.issubset(short_names)


# ---------------------------------------------------------------------------
# SERIES TIME SERIES (needs index_history rows)
# ---------------------------------------------------------------------------
async def test_indexes_time_series_empty(client):
    """With no index_history rows, the endpoint should still return 200."""
    response = await client.get('/market_data/series/time_series')

    assert response.status_code == HTTPStatus.OK


async def test_indexes_time_series_with_data(client, db):
    """Seed index_history and verify the time series endpoint returns data."""
    await db.execute(
        text(
            'INSERT INTO market_data.market_data_series_history (series_id, date, close) '
            'VALUES (:series_id, :date, :close)'
        ),
        {'series_id': 6, 'date': date(2025, 1, 2), 'close': 130000},
    )
    await db.commit()

    response = await client.get('/market_data/series/time_series')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    # At least one series should have data
    assert isinstance(data, dict)


# ---------------------------------------------------------------------------
# USD/BRL HISTORY
# ---------------------------------------------------------------------------
async def test_usd_brl_history_empty(client):
    response = await client.get('/market_data/usd-brl/history')

    assert response.status_code == HTTPStatus.OK


async def test_usd_brl_history_with_data(client, db):
    ih = UsdBrlHistory(
        date=date(2025, 1, 2),
        usd_brl=Decimal('5.25'),
        brl_usd=invert_rate(Decimal('5.25')),
        source='test',
    )
    await db.execute(
        text(
            'INSERT INTO market_data.usd_brl_history (date, usd_brl, brl_usd, source) '
            'VALUES (:date, :usd_brl, :brl_usd, :source)'
        ),
        {
            'date': ih.date,
            'usd_brl': ih.usd_brl,
            'brl_usd': ih.brl_usd,
            'source': ih.source,
        },
    )
    await db.commit()

    response = await client.get('/market_data/usd-brl/history')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# QUOTES (requires external API – mock MarketDataProvider)
# ---------------------------------------------------------------------------
async def test_get_quotes_mocked(client):
    """Mock the external market data provider to return quotes."""
    mock_quotes = {
        'ticker': 'PETR4',
        'asset_type_id': 4,
        'currency': 'BRL',
        'quotes': [
            {
                'date': '2025-01-02T00:00:00',
                'close': 37.50,
                'open': 36.80,
                'high': 38.00,
                'low': 36.50,
                'volume': 10000000,
            }
        ],
    }

    with patch(
        'app.modules.market_data.service.quote_service.OnDemandQuoteReadService.get_quotes',
        new_callable=AsyncMock,
        return_value=mock_quotes,
    ):
        response = await client.get(
            '/market_data/quotes/on-demand',
            params={'ticker': 'PETR4', 'asset_type_id': 4},
        )

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert data['ticker'] == 'PETR4'
    assert len(data['quotes']) == 1
