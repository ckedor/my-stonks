"""The cached key and the invalidated prefix have to be the same string.

They are produced in two different files by two different mechanisms -- the
`cached` decorator builds one from the call, the invalidating service builds the
other from a constant -- and nothing but a test connects them. When they drift
apart neither side raises: the write lands, the delete matches nothing, and the
stale answer is served until the TTL runs out. So these tests assert on the
whole round trip, from a real service call to the key that survives it.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.portfolio.domain.portfolio_segment import PortfolioSegment
from app.modules.portfolio.service.portfolio_position_service import PortfolioPositionService
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    PortfolioReturnsConsolidatorService,
)
from tests.fakes import FakeCache, FakeUnitOfWork


def _position_rows(portfolio_id: int) -> list[dict]:
    return [
        {
            'date': '2026-01-02',
            'asset_id': 10 + portfolio_id,
            'asset_type_id': 2,
            'category': 'FII',
            'ticker': 'FIIX11',
            'quantity': 10.0,
            'price': 100.0,
            'price_usd': 20.0,
            'dividend': 0.0,
            'dividend_usd': 0.0,
        }
    ]


def _position_service(portfolio_id: int = 7, cache: FakeCache | None = None):
    repository = SimpleNamespace(
        get_portfolio_position=AsyncMock(return_value=_position_rows(portfolio_id)),
        get_transactions=AsyncMock(return_value=[]),
        get_asset_type_returns=AsyncMock(return_value=[]),
        get_segment_asset_ids=AsyncMock(return_value=[]),
    )
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=cache or FakeCache(),
    )
    return service, repository


@pytest.mark.asyncio
async def test_patrimony_invalidation_deletes_the_key_the_read_wrote():
    service, _ = _position_service()

    await service.get_patrimony_evolution(7)
    assert service.cache.store, 'the read should have cached something to invalidate'

    await service.invalidate_patrimony_evolution(7)

    assert service.cache.store == {}


@pytest.mark.asyncio
async def test_the_same_question_asked_two_ways_is_one_cache_entry():
    """The router spells out every default; the wealth-tier reader does not.

    Keying on the call shape gave them an entry each: the same numbers computed
    twice, stored twice, and -- the part that hurt -- only one of them reachable
    by a prefix that assumes `portfolio_id` came first.
    """
    service, repository = _position_service()

    await service.get_patrimony_evolution(7, None, None, None, currency='BRL', segment=None)
    await service.get_patrimony_evolution(7, currency='BRL')
    await service.get_patrimony_evolution(portfolio_id=7)

    assert len(service.cache.store) == 1
    assert service.cache.writes == 1
    assert repository.get_portfolio_position.await_count == 1


@pytest.mark.asyncio
async def test_portfolio_id_passed_as_a_keyword_still_falls_under_the_prefix():
    """The regression that used to pass silently.

    With the key built from the call, `portfolio_id=7` produced
    `patrimony_evolution::portfolio_id=7`, which the prefix
    `patrimony_evolution:7:` never matched -- and no error said so.
    """
    service, _ = _position_service()

    await service.get_patrimony_evolution(portfolio_id=7)
    await service.invalidate_patrimony_evolution(7)

    assert service.cache.store == {}


@pytest.mark.asyncio
async def test_invalidating_portfolio_1_leaves_portfolio_10_alone():
    cache = FakeCache()
    first, _ = _position_service(1, cache=cache)
    tenth, _ = _position_service(10, cache=cache)

    await first.get_patrimony_evolution(1)
    await tenth.get_patrimony_evolution(10)
    await first.invalidate_patrimony_evolution(1)

    assert list(cache.store) == ['patrimony_evolution:10:None:None:None:BRL:None']


@pytest.mark.asyncio
async def test_returns_consolidation_drops_the_series_reads_it_replaced():
    """The consolidator owns this, because it is the one that knows it committed.

    Callers only dispatch the task; invalidating from there empties the cache
    while the old rows are still the ones in the table.
    """
    cache = FakeCache()
    position_service, _ = _position_service(7, cache=cache)
    await position_service.get_asset_type_returns(7, 2)
    await position_service.get_segment_returns(7, PortfolioSegment.FII)
    assert len(cache.store) == 2

    consolidator = PortfolioReturnsConsolidatorService(
        FakeUnitOfWork(
            portfolios=SimpleNamespace(get_portfolio_position=AsyncMock(return_value=[]))
        ),
        cache=cache,
    )
    await consolidator._invalidate_return_series(7)

    assert cache.store == {}


@pytest.mark.asyncio
async def test_deleting_a_portfolio_drops_every_read_of_it():
    """Deletion is the one write with no consolidation behind it."""
    cache = FakeCache()
    service, _ = _position_service(7, cache=cache)

    await service.get_patrimony_evolution(7)
    await service.get_asset_type_returns(7, 2)
    await service.get_segment_returns(7, PortfolioSegment.FII)
    assert len(cache.store) == 3

    await service.discard_portfolio_cache(7)

    assert cache.store == {}


@pytest.mark.asyncio
async def test_a_read_survives_a_cache_that_is_down():
    """A cache is optional infrastructure: down makes a read slow, never failed."""

    class BrokenCache(FakeCache):
        async def get_json(self, key):
            raise ConnectionError('redis is down')

        async def set_json(self, key, value, expire_seconds=None):
            raise ConnectionError('redis is down')

    service, repository = _position_service(cache=BrokenCache())

    result = await service.get_patrimony_evolution(7)

    assert result
    repository.get_portfolio_position.assert_awaited_once()


@pytest.mark.asyncio
async def test_an_empty_answer_is_not_stored():
    """`None` reads back as a miss anyway, so writing it only buys a key."""
    service, _ = _position_service()
    service.uow.portfolios.get_portfolio_position = AsyncMock(return_value=[])

    assert await service.get_patrimony_evolution(7) is None
    assert service.cache.store == {}
    assert service.cache.writes == 0
