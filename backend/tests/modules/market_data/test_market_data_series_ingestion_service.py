import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.constants import SERIES
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.market_data.service.market_data_series_ingestion_service import (
    MarketDataSeriesIngestionService,
)
from app.modules.users.domain import User  # noqa: F401
from tests.fakes import FakeCache

EXPECTED_SERIES_COUNT = 2


class FakeUoWFactory:
    def __init__(self, repository):
        self.repository = repository

    def __call__(self):
        repository = self.repository

        class FakeUoW:
            market_data = repository

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return None

        return FakeUoW()


@pytest.mark.asyncio
async def test_series_service_selects_all_available_ids_and_runs_in_parallel():
    series = [
        MarketDataSeries(
            id=item_id,
            symbol=f'S{item_id}',
            short_name=f'Series {item_id}',
            name=f'Series {item_id}',
            series_type='market_index',
            value_type='level',
            frequency='daily',
        )
        for item_id in (2, 3)
    ]
    repository = SimpleNamespace(
        get_all=AsyncMock(return_value=series),
        get_latest_series_dates=AsyncMock(return_value={2: date(2026, 8, 7), 3: date(2026, 8, 7)}),
        upsert_bulk=AsyncMock(),
    )
    active_calls = 0
    max_active_calls = 0

    async def fetch_history(*_, **__):
        nonlocal active_calls, max_active_calls
        active_calls += 1
        max_active_calls = max(max_active_calls, active_calls)
        await asyncio.sleep(0.01)
        active_calls -= 1
        return pd.DataFrame([
            {'date': date(2026, 8, 6), 'close': 100},
            {'date': date(2026, 8, 8), 'close': 102},
        ])

    provider = SimpleNamespace(
        get_series_source=lambda _: 'provider',
        get_series_historical_data=fetch_history,
    )
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(8, False, [])),
        set_execution_items=AsyncMock(),
        start_attempt=AsyncMock(side_effect=[20, 30]),
        finish_attempt=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
        is_aborted=AsyncMock(return_value=False),
    )
    service = MarketDataSeriesIngestionService(
        uow_factory=FakeUoWFactory(repository),
        ingestion_service=tracker,
        provider=provider,
        cache=FakeCache(),
    )

    await service.run(execution_id=8)

    assert max_active_calls == EXPECTED_SERIES_COUNT
    tracker.set_execution_items.assert_awaited_once()
    assert tracker.set_execution_items.await_args.kwargs['item_ids'] == [2, 3]
    assert repository.upsert_bulk.await_count == EXPECTED_SERIES_COUNT
    persisted_batches = [call.args[1] for call in repository.upsert_bulk.await_args_list]
    assert all(len(rows) == EXPECTED_SERIES_COUNT for rows in persisted_batches)
    assert all(
        {row['date'] for row in rows} == {date(2026, 8, 6), date(2026, 8, 8)}
        for rows in persisted_batches
    )


@pytest.mark.asyncio
async def test_full_series_ingestion_requests_maximum_history():
    market_series = MarketDataSeries(
        id=2,
        symbol='IPCA',
        short_name='IPCA',
        name='IPCA',
        series_type='inflation_rate',
        value_type='percentage',
        frequency='monthly',
    )
    repository = SimpleNamespace(
        get_all=AsyncMock(return_value=[market_series]),
        get_latest_series_dates=AsyncMock(return_value={2: date(2026, 8, 7)}),
        upsert_bulk=AsyncMock(),
    )
    provider = SimpleNamespace(
        get_series_source=lambda _: 'provider',
        get_series_historical_data=AsyncMock(
            return_value=pd.DataFrame([{'date': date(2026, 8, 8), 'close': 1}])
        ),
    )
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(9, True, [2])),
        set_execution_items=AsyncMock(),
        start_attempt=AsyncMock(return_value=40),
        finish_attempt=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
        is_aborted=AsyncMock(return_value=False),
    )
    service = MarketDataSeriesIngestionService(
        uow_factory=FakeUoWFactory(repository),
        ingestion_service=tracker,
        provider=provider,
        cache=FakeCache(),
    )

    await service.run(execution_id=9)

    assert provider.get_series_historical_data.await_args.kwargs['init_date'] is None


@pytest.mark.asyncio
async def test_series_with_no_new_observations_finishes_successfully_without_upsert():
    market_series = MarketDataSeries(
        id=2,
        symbol='IPCA',
        short_name='IPCA',
        name='IPCA',
        series_type='inflation_rate',
        value_type='percentage',
        frequency='monthly',
    )
    repository = SimpleNamespace(
        get_all=AsyncMock(return_value=[market_series]),
        get_latest_series_dates=AsyncMock(return_value={2: date(2026, 6, 1)}),
        upsert_bulk=AsyncMock(),
    )
    provider = SimpleNamespace(
        get_series_source=lambda _: 'provider',
        get_series_historical_data=AsyncMock(return_value=pd.DataFrame(columns=['date', 'close'])),
    )
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(10, False, [2])),
        set_execution_items=AsyncMock(),
        start_attempt=AsyncMock(return_value=50),
        finish_attempt=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
        is_aborted=AsyncMock(return_value=False),
    )
    service = MarketDataSeriesIngestionService(
        uow_factory=FakeUoWFactory(repository),
        ingestion_service=tracker,
        provider=provider,
        cache=FakeCache(),
    )

    await service.run(execution_id=10)

    repository.upsert_bulk.assert_not_awaited()
    tracker.finish_attempt.assert_awaited_once_with(
        10,
        50,
        status='success',
        parameters={
            'series_id': 2,
            'symbol': 'IPCA',
            'start_date': '2026-05-25',
            'force_full_history': False,
        },
        fetched_rows=0,
        upserted_rows=0,
    )


@pytest.mark.asyncio
async def test_ifix_incremental_ingestion_keeps_a_repair_window():
    market_series = MarketDataSeries(
        id=SERIES.IFIX,
        symbol='IFIX.SA',
        short_name='IFIX',
        name='IFIX',
        series_type='market_index',
        value_type='level',
        frequency='daily',
    )
    repository = SimpleNamespace(
        get_all=AsyncMock(return_value=[market_series]),
        get_latest_series_dates=AsyncMock(return_value={SERIES.IFIX: date.today()}),
        upsert_bulk=AsyncMock(),
    )
    provider = SimpleNamespace(
        get_series_source=lambda _: 'b3',
        get_series_historical_data=AsyncMock(return_value=pd.DataFrame(columns=['date', 'close'])),
    )
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(11, False, [SERIES.IFIX])),
        set_execution_items=AsyncMock(),
        start_attempt=AsyncMock(return_value=60),
        finish_attempt=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
        is_aborted=AsyncMock(return_value=False),
    )
    service = MarketDataSeriesIngestionService(
        uow_factory=FakeUoWFactory(repository),
        ingestion_service=tracker,
        provider=provider,
        cache=FakeCache(),
    )

    await service.run(execution_id=11)

    assert provider.get_series_historical_data.await_args.kwargs['init_date'] == (
        date.today() - pd.Timedelta(days=550)
    )
