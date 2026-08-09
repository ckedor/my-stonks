from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.domain.quote import FetchedQuotes, Quote
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)
from tests.fakes import FakeUnitOfWork

ASSET_ID = 7
PERSISTED_CLOSE = 32.5
ON_DEMAND_CLOSE = 100_000


@pytest.mark.asyncio
async def test_persisted_quote_read_uses_only_registered_assets_and_database():
    asset = SimpleNamespace(id=ASSET_ID, ticker='PETR4', asset_type_id=4)
    asset_repository = SimpleNamespace(
        get_by_ids=AsyncMock(return_value=[asset]),
        get_by_tickers=AsyncMock(),
    )
    quote_repository = SimpleNamespace(
        get_quotes=AsyncMock(
            return_value=[
                Quote(
                    asset_id=ASSET_ID,
                    date=date(2026, 8, 8),
                    close=PERSISTED_CLOSE,
                    source='source',
                )
            ]
        )
    )
    service = PersistedQuoteReadService(
        FakeUnitOfWork(assets=asset_repository, quotes=quote_repository)
    )

    result = await service.get_quotes(asset_ids=[ASSET_ID])

    asset_repository.get_by_ids.assert_awaited_once_with([ASSET_ID])
    quote_repository.get_quotes.assert_awaited_once_with(
        [ASSET_ID],
        start_date=None,
    )
    assert result[0]['asset_id'] == ASSET_ID
    assert result[0]['quotes'][0]['close'] == PERSISTED_CLOSE


@pytest.mark.asyncio
async def test_persisted_quote_read_rejects_ambiguous_identity_and_missing_assets():
    service = PersistedQuoteReadService(
        FakeUnitOfWork(
            assets=SimpleNamespace(get_by_ids=AsyncMock(return_value=[])),
            quotes=SimpleNamespace(get_quotes=AsyncMock()),
        )
    )

    with pytest.raises(ValidationError):
        await service.get_quotes()
    with pytest.raises(NotFoundError):
        await service.get_quotes(asset_ids=[999])


class FakeCache:
    """In-memory stand-in for RedisService, so these tests need no server."""

    def __init__(self) -> None:
        self.store: dict[str, object] = {}

    async def get_json(self, key: str):
        return self.store.get(key)

    async def set_json(self, key: str, value, expire_seconds: int | None = None) -> None:
        self.store[key] = value


def build_on_demand_service(cache: FakeCache | None = None):
    provider = SimpleNamespace(
        fetch_quotes=AsyncMock(
            return_value=FetchedQuotes(
                ticker='BTC',
                currency='USD',
                source='source',
                parameters={},
                quotes=[Quote(date=date(2026, 8, 8), close=ON_DEMAND_CLOSE)],
            )
        ),
        close=AsyncMock(),
    )
    return OnDemandQuoteReadService(provider, cache=cache or FakeCache()), provider


@pytest.mark.asyncio
async def test_on_demand_quote_read_calls_only_provider_and_does_not_persist():
    service, provider = build_on_demand_service()

    result = await service.get_quotes(ticker='BTC', asset_type_id=13)

    provider.fetch_quotes.assert_awaited_once_with(
        ticker='BTC',
        asset_type_id=13,
        start_date=None,
        exchange=None,
    )
    assert result['ticker'] == 'BTC'
    assert result['quotes'][0]['close'] == ON_DEMAND_CLOSE
    assert result['quotes'][0]['date'] == '2026-08-08'


@pytest.mark.asyncio
async def test_on_demand_quote_read_reuses_the_cached_read():
    service, provider = build_on_demand_service()

    first = await service.get_quotes(ticker='BTC', asset_type_id=13)
    second = await service.get_quotes(ticker='BTC', asset_type_id=13)

    assert first == second
    provider.fetch_quotes.assert_awaited_once()


@pytest.mark.asyncio
async def test_on_demand_quote_read_does_not_mix_tickers_in_the_cache():
    cache = FakeCache()
    service, provider = build_on_demand_service(cache)

    await service.get_quotes(ticker='BTC', asset_type_id=13)
    await service.get_quotes(ticker='ETH', asset_type_id=13)

    assert provider.fetch_quotes.await_count == 2
    assert len(cache.store) == 2
