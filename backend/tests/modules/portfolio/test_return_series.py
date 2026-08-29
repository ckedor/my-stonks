"""One table, four scopes, one consolidation.

The portfolio, its categories, its asset types and its segments are the same
weighted arithmetic over different groupings, so they are consolidated together
and read the same way. These tests hold that: the consolidator emits every scope
in one pass, and the readers are selects rather than a second computation.
"""

from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.portfolio.domain.entities import ReturnSeries
from app.modules.portfolio.domain.portfolio_segment import PortfolioSegment
from app.modules.portfolio.domain.return_scope import WHOLE_PORTFOLIO_KEY, ReturnScope
from app.modules.portfolio.service.portfolio_position_service import PortfolioPositionService
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    CONSOLIDATION_PARTIAL,
    PortfolioReturnsConsolidatorService,
)
from tests.fakes import FakeCache, FakeUnitOfWork

FII_TYPE_ID = 2
STOCK_TYPE_ID = 4


def _position_history() -> list[dict]:
    """An FII and a B3 stock, three dates. The FII gains 21%, the stock loses 1%."""
    rows = []
    for day, fii_price, stock_price in (
        ('2025-01-02', 100.0, 20.0),
        ('2025-07-02', 110.0, 22.0),
        ('2026-01-02', 121.0, 19.8),
    ):
        rows.extend([
            {
                'date': day,
                'asset_id': 10,
                'asset_type_id': FII_TYPE_ID,
                'ticker': 'FIIX11',
                'exchange': 'B3',
                'category': 'Imóveis',
                'quantity': 10.0,
                'price': fii_price,
                'price_usd': fii_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
            {
                'date': day,
                'asset_id': 20,
                'asset_type_id': STOCK_TYPE_ID,
                'ticker': 'ACAO3',
                'exchange': 'B3',
                'category': 'Ações',
                'quantity': 10.0,
                'price': stock_price,
                'price_usd': stock_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
        ])
    return rows


def _consolidator(categories: list | None = None):
    repository = SimpleNamespace(
        get_portfolio_position=AsyncMock(return_value=_position_history()),
        get=AsyncMock(return_value=categories if categories is not None else []),
        upsert_bulk=AsyncMock(),
    )
    uow = FakeUnitOfWork(portfolios=repository)
    return PortfolioReturnsConsolidatorService(uow), repository


def _by_scope(records: list[dict], scope: ReturnScope) -> list[dict]:
    return [record for record in records if record['scope'] == str(scope)]


@pytest.mark.asyncio
async def test_one_run_writes_every_scope_into_one_table():
    service, repository = _consolidator(
        categories=[
            SimpleNamespace(id=31, name='Imóveis'),
            SimpleNamespace(id=32, name='Ações'),
        ]
    )

    await service.consolidate_returns(7)

    entity, records = repository.upsert_bulk.await_args.args
    assert entity is ReturnSeries
    assert repository.upsert_bulk.await_args.kwargs['unique_columns'] == [
        'portfolio_id',
        'scope',
        'scope_key',
        'date',
    ]

    scopes = {record['scope'] for record in records}
    assert scopes == {
        str(ReturnScope.PORTFOLIO),
        str(ReturnScope.CATEGORY),
        str(ReturnScope.ASSET_TYPE),
        str(ReturnScope.SEGMENT),
    }


@pytest.mark.asyncio
async def test_asset_type_series_keeps_the_numbers_it_had():
    """The unified table changed where the series lives, not what it says."""
    service, repository = _consolidator()

    await service.consolidate_returns(7)
    _, records = repository.upsert_bulk.await_args.args

    fii = [
        record
        for record in _by_scope(records, ReturnScope.ASSET_TYPE)
        if record['scope_key'] == str(FII_TYPE_ID)
    ]
    assert len(fii) == 3
    assert fii[-1]['acc_return'] == pytest.approx(0.21)
    assert fii[-1]['cagr'] == pytest.approx(0.21, rel=0.01)

    stock = [
        record
        for record in _by_scope(records, ReturnScope.ASSET_TYPE)
        if record['scope_key'] == str(STOCK_TYPE_ID)
    ]
    assert stock[-1]['acc_return'] == pytest.approx(-0.01)


@pytest.mark.asyncio
async def test_segments_are_persisted_like_any_other_scope():
    """Including the ones that cut an asset type by market.

    Those had no series at all before, which is why reading one used to be a
    computation. Both assets here trade on B3, so the FII lands in `fii` and the
    stock in `equity-br` -- and nothing lands in `equity-world`.
    """
    service, repository = _consolidator()

    await service.consolidate_returns(7)
    _, records = repository.upsert_bulk.await_args.args

    segments = {record['scope_key'] for record in _by_scope(records, ReturnScope.SEGMENT)}
    assert segments == {str(PortfolioSegment.FII), str(PortfolioSegment.EQUITY_BR)}

    equity_br = [
        record
        for record in _by_scope(records, ReturnScope.SEGMENT)
        if record['scope_key'] == str(PortfolioSegment.EQUITY_BR)
    ]
    assert equity_br[-1]['acc_return'] == pytest.approx(-0.01)


@pytest.mark.asyncio
async def test_the_portfolio_series_uses_the_empty_key():
    """Empty string and not NULL: Postgres would let the same day in twice."""
    service, repository = _consolidator()

    await service.consolidate_returns(7)
    _, records = repository.upsert_bulk.await_args.args

    whole = _by_scope(records, ReturnScope.PORTFOLIO)
    assert {record['scope_key'] for record in whole} == {WHOLE_PORTFOLIO_KEY}
    assert len(whole) == 3


@pytest.mark.asyncio
async def test_a_category_series_is_keyed_by_id_not_by_name():
    """A renamed category is still the same series."""
    service, repository = _consolidator(categories=[SimpleNamespace(id=31, name='Imóveis')])

    await service.consolidate_returns(7)
    _, records = repository.upsert_bulk.await_args.args

    categories = _by_scope(records, ReturnScope.CATEGORY)
    assert {record['scope_key'] for record in categories} == {'31'}


@pytest.mark.asyncio
async def test_reading_a_segment_is_a_select_and_not_a_computation():
    repository = SimpleNamespace(
        get_return_series=AsyncMock(
            return_value=[
                {
                    'date': date(2026, 1, 2),
                    'daily_return': 0.01,
                    'acc_return': 0.21,
                    'cagr': 0.21,
                }
            ]
        ),
        get_portfolio_position=AsyncMock(),
    )
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=FakeCache(),
    )

    result = await service.get_segment_returns(7, PortfolioSegment.EQUITY_BR)

    repository.get_return_series.assert_awaited_once_with(
        7,
        scope=ReturnScope.SEGMENT,
        scope_key=str(PortfolioSegment.EQUITY_BR),
        currency='BRL',
    )
    repository.get_portfolio_position.assert_not_awaited()
    assert result == [
        {'date': '2026-01-02', 'daily_return': 0.01, 'acc_return': 0.21, 'cagr': 0.21}
    ]


@pytest.mark.asyncio
async def test_an_empty_series_reads_as_empty_and_not_as_the_whole_portfolio():
    repository = SimpleNamespace(
        get_return_series=AsyncMock(return_value=[]),
        get_portfolio_position=AsyncMock(),
    )
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=FakeCache(),
    )

    assert await service.get_segment_returns(7, PortfolioSegment.CRYPTO) == []
    repository.get_portfolio_position.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_stamp_records_a_partial_run():
    """A run that lost an asset is not a clean run, and the stamp has to say so."""
    repository = SimpleNamespace(upsert_bulk=AsyncMock())
    service = PortfolioReturnsConsolidatorService(FakeUnitOfWork(portfolios=repository))

    await service.mark_consolidated(7, status=CONSOLIDATION_PARTIAL, error='ativo 10 falhou')

    entity, records = repository.upsert_bulk.await_args.args
    assert repository.upsert_bulk.await_args.kwargs['unique_columns'] == ['portfolio_id']
    assert records[0]['portfolio_id'] == 7
    assert records[0]['status'] == CONSOLIDATION_PARTIAL
    assert records[0]['error'] == 'ativo 10 falhou'
    stamped_at = records[0]['consolidated_at']
    assert isinstance(stamped_at, datetime)
    # Com fuso: o carimbo é lido de outro lugar do mundo que não o servidor.
    assert stamped_at.tzinfo is not None


@pytest.mark.asyncio
async def test_deleting_a_category_deletes_its_series():
    """`scope_key` is text, so nothing cascades and the series would outlive it."""
    from app.modules.portfolio.service.portfolio_category_service import (
        PortfolioCategoryService,
    )

    portfolios = SimpleNamespace(delete_return_series=AsyncMock())
    repository = SimpleNamespace(
        get=AsyncMock(return_value=SimpleNamespace(id=31, portfolio_id=7)),
        delete=AsyncMock(),
    )
    uow = FakeUnitOfWork(repository=repository, portfolios=portfolios)

    await PortfolioCategoryService(uow).delete_custom_category(31)

    portfolios.delete_return_series.assert_awaited_once_with(
        7, scope=ReturnScope.CATEGORY, scope_key='31'
    )
    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_deleting_a_portfolio_deletes_its_series_and_its_stamp():
    from app.modules.portfolio.domain.entities import PortfolioConsolidation
    from app.modules.portfolio.service.portfolio_base_service import PortfolioBaseService

    portfolios = SimpleNamespace(
        # A carteira em si, depois a lista de categorias dela.
        get=AsyncMock(side_effect=[SimpleNamespace(id=7), []]),
        delete=AsyncMock(),
        delete_return_series=AsyncMock(),
    )
    uow = FakeUnitOfWork(portfolios=portfolios)

    await PortfolioBaseService(uow).delete_portfolio(7)

    portfolios.delete_return_series.assert_awaited_once_with(7)
    deleted_entities = [call.args[0] for call in portfolios.delete.await_args_list]
    assert PortfolioConsolidation in deleted_entities
