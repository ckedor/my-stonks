from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pandas as pd
import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.msci_index_client import MsciIndexClient
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


@pytest.mark.asyncio
async def test_msci_index_reads_net_levels_by_index_code_without_filling_dates():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.msci_index_client = SimpleNamespace(
        get_daily_levels=AsyncMock(
            return_value=[
                {'level_eod': 16110.4, 'calc_date': 20260921},
                {'level_eod': 16046.7, 'calc_date': 20260925},
            ]
        )
    )
    series = build_series(series_id=SERIES.MSCI_WORLD, symbol='990100')

    result = await provider.get_series_historical_data(series, init_date=date(2026, 9, 20))

    assert result[['date', 'close']].to_dict(orient='records') == [
        {'date': pd.Timestamp('2026-09-21'), 'close': 16110.4},
        {'date': pd.Timestamp('2026-09-25'), 'close': 16046.7},
    ]
    kwargs = provider.msci_index_client.get_daily_levels.await_args.kwargs
    assert kwargs['index_code'] == '990100'
    assert kwargs['start_date'] == date(2026, 9, 20)
    assert provider.get_series_source(series) == 'msci'


@pytest.mark.asyncio
async def test_gold_reads_the_provider_history_without_filling_dates():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.brapi_client = SimpleNamespace(
        get_stock_historical=AsyncMock(
            return_value={
                'results': [
                    {
                        'symbol': 'GC=F',
                        'data': {
                            'historicalDataPrice': [
                                {'date': 1789700400, 'close': 4300.0},
                                {'date': 1789959600, 'close': 4321.2},
                            ]
                        },
                    }
                ]
            }
        )
    )
    series = build_series(series_id=SERIES.GOLD, symbol='GC=F')

    result = await provider.get_series_historical_data(series, init_date=date(2026, 9, 14))

    # Friday then Monday: the weekend stays out.
    assert result['date'].tolist() == [pd.Timestamp('2026-09-18'), pd.Timestamp('2026-09-21')]
    assert result['close'].tolist() == [4300.0, 4321.2]
    assert provider.get_series_source(series) == 'brapi'


@pytest.mark.asyncio
async def test_msci_error_answered_with_200_fails_instead_of_returning_no_rows():
    client = MsciIndexClient()
    client.http = SimpleNamespace(
        request=AsyncMock(
            return_value={
                'error_code': ' 100',
                'error_message': " null Invalid Parameter start_date : '19691231'",
            }
        )
    )

    with pytest.raises(IntegrationBadResponse):
        await client.get_daily_levels(
            index_code='990100',
            start_date=date(1969, 12, 31),
            end_date=date(2026, 9, 26),
        )

    params = client.http.request.await_args.kwargs['params']
    assert params['start_date'] == '19970101'
    assert params['index_variant'] == 'NETR'
