"""The exchange-rate cache and the ingestion that drops it."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.service.market_data_service import (
    SERIES_HISTORY_CACHE_PREFIX,
)
from app.modules.market_data.service.usd_brl_ingestion_service import (
    USD_BRL_DATASET_ID,
    UsdBrlIngestionService,
)
from app.modules.market_data.service.usd_brl_service import (
    USD_BRL_HISTORY_CACHE_PREFIX,
)
from app.modules.users.domain import User  # noqa: F401
from tests.fakes import FakeCache, FakeUnitOfWork, fake_uow_factory


def build_ingestion_service(cache: FakeCache, uow: FakeUnitOfWork) -> UsdBrlIngestionService:
    ingestion_service = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(11, False, [USD_BRL_DATASET_ID])),
        set_execution_items=AsyncMock(),
        start_attempt=AsyncMock(return_value=99),
        finish_attempt=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
    )
    provider = SimpleNamespace(
        get_usd_brl_historical_data=AsyncMock(
            return_value=pd.DataFrame([{'date': date(2026, 8, 7), 'usd_brl': 5.0}])
        )
    )
    return UsdBrlIngestionService(
        uow_factory=fake_uow_factory(uow),
        ingestion_service=ingestion_service,
        provider=provider,
        cache=cache,
    )


@pytest.mark.asyncio
async def test_ingestion_drops_the_rate_and_index_caches_after_the_write():
    cache = FakeCache()
    # Both families are seeded, including a neighbour key that must survive.
    await cache.set_json(f'{USD_BRL_HISTORY_CACHE_PREFIX}::', [{'date': '2026-08-06'}])
    await cache.set_json(f'{SERIES_HISTORY_CACHE_PREFIX}:2021-01-01:', {'CDI': []})
    await cache.set_json('assets_list::', ['PETR4'])

    uow = FakeUnitOfWork(
        market_data=SimpleNamespace(
            get_latest_usd_brl_date=AsyncMock(return_value=date(2026, 8, 6)),
            upsert_bulk=AsyncMock(),
        )
    )
    service = build_ingestion_service(cache, uow)

    await service.run(execution_id=11)

    assert f'{USD_BRL_HISTORY_CACHE_PREFIX}::' not in cache.store
    assert f'{SERIES_HISTORY_CACHE_PREFIX}:2021-01-01:' not in cache.store
    # Unrelated caches are left alone.
    assert 'assets_list::' in cache.store


@pytest.mark.asyncio
async def test_a_failed_ingestion_leaves_the_cache_in_place():
    cache = FakeCache()
    await cache.set_json(f'{USD_BRL_HISTORY_CACHE_PREFIX}::', [{'date': '2026-08-06'}])

    uow = FakeUnitOfWork(
        market_data=SimpleNamespace(
            get_latest_usd_brl_date=AsyncMock(return_value=date(2026, 8, 6)),
            upsert_bulk=AsyncMock(side_effect=RuntimeError('database is down')),
        )
    )
    service = build_ingestion_service(cache, uow)

    with pytest.raises(RuntimeError, match='database is down'):
        await service.run(execution_id=11)

    # Nothing was written, so the cached history is still the truth.
    assert f'{USD_BRL_HISTORY_CACHE_PREFIX}::' in cache.store
