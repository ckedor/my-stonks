"""Bater posição: o extrato contra as transações, sem gravar nada."""

from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.modules.market_data.domain.constants import CURRENCY
from app.modules.portfolio.domain.document import DocumentKind
from app.modules.portfolio.domain.outputs import (
    PositionStatementHoldingReading,
    PositionStatementReading,
)
from app.modules.portfolio.domain.position_statement import (
    PositionMatch,
    StatementHolding,
    compare_positions,
    held_quantities,
)
from app.modules.portfolio.service.position_statement_service import PositionStatementService
from tests.fakes import FakeUnitOfWork

AS_OF = date(2026, 9, 30)


def _t(asset_id, quantity, on):
    return SimpleNamespace(
        asset_id=asset_id, quantity=quantity, date=datetime.combine(on, datetime.min.time())
    )


def _h(index, asset_id, quantity):
    return StatementHolding(
        index=index, security='x', ticker=None, quantity=quantity, asset_id=asset_id
    )


class TestHeldQuantities:
    def test_sums_up_to_the_statement_day_only(self):
        transactions = [
            _t(1, 10, date(2026, 1, 5)),
            _t(1, -4, date(2026, 5, 5)),
            _t(1, 100, date(2026, 10, 1)),
        ]

        assert held_quantities(transactions, [], AS_OF) == {1: 6}

    def test_a_split_multiplies_what_was_bought_before_it(self):
        transactions = [_t(1, 10, date(2026, 1, 5)), _t(1, 5, date(2026, 6, 1))]
        split = SimpleNamespace(asset_id=1, date=date(2026, 3, 1), factor=2)
        later = SimpleNamespace(asset_id=1, date=date(2026, 12, 1), factor=10)

        # Depois do extrato, o desdobramento de dezembro ainda não aconteceu.
        assert held_quantities(transactions, [split, later], AS_OF) == {1: 25}


class TestComparePositions:
    def test_each_kind_of_difference(self):
        holdings = [_h(0, 1, 10), _h(1, 2, 7), _h(2, 4, 3), _h(3, None, 9)]
        app = {1: 10.00001, 2: 5, 3: 12}

        by_status = {diff.status: diff for diff in compare_positions(holdings, app)}

        assert by_status[PositionMatch.MATCH].asset_id == 1
        different = by_status[PositionMatch.DIFFERENT]
        assert (different.asset_id, different.difference) == (2, 2)
        assert by_status[PositionMatch.MISSING_IN_STATEMENT].asset_id == 3
        assert by_status[PositionMatch.MISSING_IN_APP].asset_id == 4
        assert by_status[PositionMatch.UNRESOLVED].holdings == (3,)

    def test_differences_come_first(self):
        diffs = compare_positions([_h(0, 1, 10), _h(1, 2, 1)], {1: 10, 2: 2})

        assert [d.status for d in diffs] == [PositionMatch.DIFFERENT, PositionMatch.MATCH]

    def test_lines_of_the_same_asset_are_summed(self):
        # Disponível e bloqueada, em duas linhas do extrato.
        (diff,) = compare_positions([_h(0, 1, 6), _h(1, 1, 4)], {1: 10})

        assert (diff.status, diff.statement_quantity, diff.holdings) == (
            PositionMatch.MATCH,
            10,
            (0, 1),
        )

    def test_a_position_closed_in_the_app_is_not_listed(self):
        assert compare_positions([], {1: 0.0}) == []


async def test_reading_a_statement_writes_nothing_and_compares_at_the_broker():
    reading = PositionStatementReading(
        broker_name='AVENUE SECURITIES LLC',
        broker_cnpj=None,
        currency='USD',
        as_of=AS_OF,
        holdings=[
            PositionStatementHoldingReading(
                security='INVESCO NASDAQ 100', ticker='QQQM', quantity=3
            ),
            PositionStatementHoldingReading(security='CASH SWEEP', ticker=None, quantity=1),
        ],
    )
    portfolios = SimpleNamespace(
        list_brokers=AsyncMock(
            return_value=[SimpleNamespace(id=2, name='Avenue', cnpj='1', currency_id=CURRENCY.USD)]
        ),
        get_broker_transactions_until=AsyncMock(return_value=[_t(59, 5, date(2026, 1, 5))]),
        get_events_for_assets=AsyncMock(return_value=[]),
    )
    assets = SimpleNamespace(
        get_by_tickers=AsyncMock(return_value=[SimpleNamespace(id=59, ticker='QQQM', name='QQQM')])
    )
    uow = FakeUnitOfWork(portfolios=portfolios, assets=assets)
    extractor = SimpleNamespace(extract=AsyncMock(return_value=(reading, 'gpt-4o')))
    documents = SimpleNamespace(store=AsyncMock(return_value=55))
    service = PositionStatementService(uow=uow, extractor=extractor, documents=documents)

    draft = await service.extract(portfolio_id=1, filename='avenue.pdf', content=b'%PDF-1.7 x')

    assert draft.document_id == 55
    documents.store.assert_awaited_once_with(
        portfolio_id=1,
        kind=DocumentKind.POSITION_STATEMENT,
        filename='avenue.pdf',
        content=b'%PDF-1.7 x',
    )

    assert (draft.broker_id, draft.currency, draft.warnings) == (2, 'USD', ())
    portfolios.get_broker_transactions_until.assert_awaited_once_with(1, 2, AS_OF)
    by_status = {diff.status: diff for diff in draft.positions}
    assert by_status[PositionMatch.DIFFERENT].difference == -2
    assert PositionMatch.UNRESOLVED in by_status
    uow.commit.assert_not_awaited()
