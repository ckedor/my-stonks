from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import INDEX
from app.modules.market_data.domain.market_data_series import MarketDataSeries


def build_series(*, series_id: int, symbol: str) -> MarketDataSeries:
    return MarketDataSeries(
        id=series_id,
        symbol=symbol,
        short_name=symbol,
        name=symbol,
        series_type='market_index',
        value_type='level',
        frequency='daily',
    )


@pytest.mark.asyncio
async def test_ipca_keeps_bcb_as_primary_source():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.bcb_api_client = SimpleNamespace(
        get_market_index_history_df=AsyncMock(
            return_value=pd.DataFrame([
                {'date': pd.Timestamp('2026-05-01'), 'value': 0.58},
                {'date': pd.Timestamp('2026-06-01'), 'value': 0.16},
            ])
        )
    )
    series = build_series(series_id=INDEX.IPCA, symbol='IPCA')

    result = await provider.get_series_historical_data(
        series,
        init_date=pd.Timestamp('2026-01-01'),
    )

    assert result[['date', 'close']].to_dict(orient='records') == [
        {'date': pd.Timestamp('2026-05-01'), 'close': 0.58},
        {'date': pd.Timestamp('2026-06-01'), 'close': 0.16},
    ]
    provider.bcb_api_client.get_market_index_history_df.assert_awaited_once_with(
        'IPCA',
        init_date=pd.Timestamp('2026-01-01'),
    )
    assert provider.get_series_source(series) == 'bcb'


@pytest.mark.asyncio
async def test_ifix_uses_market_history_and_normalizes_ohlc_without_filling_dates():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.brapi_client = SimpleNamespace(
        get_stock_historical=AsyncMock(
            return_value={
                'results': [
                    {
                        'requestedSymbol': 'IFIX.SA',
                        'symbol': 'IFIX.SA',
                        'data': {
                            'historicalDataPrice': [
                                {
                                    'date': 1735776000,
                                    'open': 3100.0,
                                    'high': 3120.0,
                                    'low': 3090.0,
                                    'close': 3110.0,
                                    'volume': 0,
                                },
                                {
                                    'date': 1736035200,
                                    'open': 3110.0,
                                    'high': 3130.0,
                                    'low': 3100.0,
                                    'close': 3125.0,
                                    'volume': 0,
                                },
                            ]
                        },
                    }
                ]
            }
        )
    )
    series = build_series(series_id=INDEX.IFIX, symbol='IFIX.SA')

    result = await provider.get_series_historical_data(
        series,
        init_date=date(2025, 1, 1),
    )

    assert result['date'].tolist() == [
        pd.Timestamp('2025-01-02'),
        pd.Timestamp('2025-01-05'),
    ]
    assert result['close'].tolist() == [3110.0, 3125.0]
    provider.brapi_client.get_stock_historical.assert_awaited_once_with(
        symbols='IFIX.SA',
        interval='1d',
        startDate='2025-01-01',
        endDate=provider.brapi_client.get_stock_historical.await_args.kwargs['endDate'],
        sortOrder='asc',
    )
    assert provider.get_series_source(series) == 'brapi'
