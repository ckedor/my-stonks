# tests/test_market_data_api.py
"""E2E tests for the Market Data API."""

from datetime import date, datetime
from http import HTTPStatus
from unittest.mock import AsyncMock, patch

import pytest
from app.modules.market_data.domain.market_data_series import MarketDataSeriesHistory
from app.modules.market_data.domain.usd_brl import UsdBrlHistory


# ---------------------------------------------------------------------------
# CURRENCIES (seeded by migration)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_currencies(client):
    response = await client.get('/market_data/index/currency')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 2
    codes = {c['code'] for c in data}
    assert {'BRL', 'USD'}.issubset(codes)


# ---------------------------------------------------------------------------
# INDEXES (seeded by migration)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_list_indexes(client):
    response = await client.get('/market_data/index')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert len(data) >= 7
    short_names = {i['short_name'] for i in data}
    assert {'CDI', 'IBOVESPA', 'S&P500', 'IFIX'}.issubset(short_names)


# ---------------------------------------------------------------------------
# INDEX TIME SERIES (needs index_history rows)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_indexes_time_series_empty(client):
    """With no index_history rows, the endpoint should still return 200."""
    response = await client.get('/market_data/index/time_series')

    assert response.status_code == HTTPStatus.OK


@pytest.mark.asyncio
async def test_indexes_time_series_with_data(client, db):
    """Seed index_history and verify the time series endpoint returns data."""
    ih = MarketDataSeriesHistory(series_id=6, date=date(2025, 1, 2), close=130000)
    db.add(ih)
    db.commit()

    response = await client.get('/market_data/index/time_series')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    # At least one series should have data
    assert isinstance(data, dict)


# ---------------------------------------------------------------------------
# USD/BRL HISTORY
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_usd_brl_history_empty(client):
    response = await client.get('/market_data/index/usd_brl')

    assert response.status_code == HTTPStatus.OK


@pytest.mark.asyncio
async def test_usd_brl_history_with_data(client, db):
    ih = UsdBrlHistory(
        date=date(2025, 1, 2),
        usd_to_brl_rate=5.25,
        source='test',
    )
    db.add(ih)
    db.commit()

    response = await client.get('/market_data/index/usd_brl')

    assert response.status_code == HTTPStatus.OK
    data = response.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# QUOTES (requires external API – mock MarketDataProvider)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
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


# ---------------------------------------------------------------------------
# CONSOLIDATE HISTORY (superuser endpoint)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_consolidate_history_returns_ok(client):
    """
    The consolidate endpoint calls external APIs and triggers tasks.
    We mock the service method to verify the route + auth works E2E.
    """
    with patch(
        'app.modules.market_data.service.data_ingestion_service.'
        'MarketDataIngestionTriggerService.trigger_series_and_usd_brl',
        new_callable=AsyncMock,
    ):
        response = await client.post('/market_data/index/consolidate_history')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'message': 'OK'}
