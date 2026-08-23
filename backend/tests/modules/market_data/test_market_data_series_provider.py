from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pandas as pd
import pytest

from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import SERIES
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
    series = build_series(series_id=SERIES.IPCA, symbol='IPCA')

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
    provider.b3_index_client = SimpleNamespace(
        get_daily_evolution=AsyncMock(
            side_effect=[
                {
                    'results': [
                        {'day': 2, 'rateValue1': '3.110,00'},
                        {'day': 5, 'rateValue1': '3.125,50'},
                    ]
                },
                {'results': []},
            ]
        )
    )
    series = build_series(series_id=SERIES.IFIX, symbol='IFIX.SA')

    result = await provider.get_series_historical_data(
        series,
        init_date=date(2025, 1, 1),
    )

    assert result['date'].tolist() == [
        pd.Timestamp('2025-01-02'),
        pd.Timestamp('2025-01-05'),
    ]
    assert result['close'].tolist() == [3110.0, 3125.5]
    assert provider.b3_index_client.get_daily_evolution.await_args_list == [
        call(index='IFIX', year=2025),
        call(index='IFIX', year=2026),
    ]
    assert provider.get_series_source(series) == 'b3'
