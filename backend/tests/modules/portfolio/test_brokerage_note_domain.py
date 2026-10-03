"""A nota de corretagem se confere, se rateia e se cruza com a carteira sem banco."""

from datetime import date, datetime
from types import SimpleNamespace
from typing import ClassVar

import pytest

from app.modules.portfolio.domain.brokerage_note import (
    GroupAction,
    GroupStatus,
    NoteLine,
    allocate_costs,
    check_note,
    line_ticker,
    match_broker,
    normalize_ticker,
    reconcile,
)
from app.modules.portfolio.domain.entities import Transaction
from app.modules.portfolio.domain.outputs import BrokerageNoteLineReading, BrokerageNoteReading

PREGAO = date(2026, 9, 1)
BROKER = 7
OTHER_BROKER = 8
PETR4 = 101


def _line(side='C', quantity=100.0, price=30.0, value=None, security='PETROBRAS PN N2'):
    return BrokerageNoteLineReading(
        side=side,
        market='VISTA',
        security=security,
        ticker='PETR4',
        fund_cnpj=None,
        isin=None,
        quantity=quantity,
        price=price,
        value=value if value is not None else quantity * price,
        fees=None,
    )


def _reading(lines, **overrides) -> BrokerageNoteReading:
    fields = {
        'broker_name': 'NU INVEST CORRETORA',
        'broker_cnpj': '62.169.875/0001-79',
        'currency': 'BRL',
        'note_number': '123',
        'trade_date': PREGAO,
        'settlement_date': date(2026, 9, 3),
        'lines': lines,
        'purchases_total': None,
        'sales_total': None,
        'operations_total': None,
        'settlement_fee': None,
        'registration_fee': None,
        'emoluments': None,
        'other_exchange_fees': None,
        'brokerage': None,
        'iss': None,
        'other_costs': None,
        'withheld_income_tax': None,
        'net_amount': None,
    }
    return BrokerageNoteReading(**(fields | overrides))


def _note_line(line_index=0, side='C', quantity=100.0, price=30.0, **overrides) -> NoteLine:
    fields = {
        'note_index': 0,
        'line_index': line_index,
        'broker_id': BROKER,
        'asset_id': PETR4,
        'trade_date': PREGAO,
        'settlement_date': date(2026, 9, 3),
        'side': side,
        'quantity': quantity,
        'price': price,
        'fees': 0.5,
        'withheld_income_tax': None,
    }
    return NoteLine(**(fields | overrides))


def _transaction(id, quantity, price, broker_id=BROKER, on=PREGAO, **fields) -> Transaction:
    return Transaction(
        id=id,
        portfolio_id=1,
        asset_id=PETR4,
        broker_id=broker_id,
        date=datetime.combine(on, datetime.min.time()),
        quantity=quantity,
        price=price,
        **fields,
    )


class TestNormalizeTicker:
    @pytest.mark.parametrize(
        ('raw', 'expected'),
        [
            ('PETR4F', 'PETR4'),
            ('taee11f', 'TAEE11'),
            (' ITSA4 ', 'ITSA4'),
            ('XPML11 CI ER', 'XPML11'),
            ('NSDV11 CI', 'NSDV11'),
            ('PETROBRAS PN N2', None),
            ('', None),
            (None, None),
        ],
    )
    def test_reads_the_b3_code_out_of_what_the_model_returned(self, raw, expected):
        assert normalize_ticker(raw) == expected

    def test_a_ticker_ending_in_f_that_is_not_fractional_stays(self):
        assert normalize_ticker('HGLG11') == 'HGLG11'

    def test_the_specification_answers_when_the_model_gave_no_ticker(self):
        # O caso da Nubank: o código está na especificação, e o modelo não o repetiu.
        assert line_ticker(None, 'XPML11 CI ER') == 'XPML11'
        assert line_ticker('XPML11 CI ER', 'XP MALLS') == 'XPML11'
        assert line_ticker(None, 'ITAUSA PN EJ N1') is None

    def test_a_dollar_note_reads_the_symbol_column_only(self):
        assert line_ticker('QQQM', 'INVESCO EXCHANGE TRADED FD TR II', 'USD') == 'QQQM'
        assert line_ticker('BRK.B', None, 'USD') == 'BRK.B'
        # Sem símbolo, a descrição não é vasculhada: "TR" ou "ETF" não são tickers.
        assert line_ticker(None, 'INVESCO EXCHANGE TRADED FD TR II', 'USD') is None


class TestMatchBroker:
    brokers: ClassVar[list] = [
        SimpleNamespace(id=2, name='Avenue', cnpj='46.730.175/0001-55'),
        SimpleNamespace(id=3, name='Nu Investimentos', cnpj='62.169.875/0001-79'),
        SimpleNamespace(id=1, name='XP Investimentos', cnpj='02.332.886/0001-04'),
    ]

    def test_the_cnpj_decides_first(self):
        assert match_broker(self.brokers, '62169875000179', 'qualquer nome').id == 3

    def test_without_cnpj_the_registered_name_must_appear_in_the_printed_one(self):
        assert match_broker(self.brokers, None, 'AVENUE SECURITIES LLC').id == 2

    def test_a_name_matching_two_brokers_is_left_to_the_person(self):
        assert match_broker(self.brokers, None, 'Investimentos') is None
        assert match_broker(self.brokers, None, 'XP NU INVESTIMENTOS') is None


class TestAllocateCosts:
    def test_costs_split_by_value_and_add_up_to_the_note(self):
        reading = _reading(
            [_line(quantity=1, price=10), _line(quantity=1, price=10), _line(quantity=1, price=10)],
            settlement_fee=0.01,
            emoluments=0.09,
        )

        fees = [fee for fee, _ in allocate_costs(reading)]

        assert sum(fees) == pytest.approx(0.10)
        assert sorted(fees) == [0.03, 0.03, 0.04]

    def test_withheld_tax_goes_only_to_sales(self):
        reading = _reading(
            [_line(side='C', quantity=100, price=10), _line(side='V', quantity=100, price=20)],
            brokerage=3.0,
            withheld_income_tax=0.10,
        )

        (buy_fee, buy_tax), (sell_fee, sell_tax) = allocate_costs(reading)

        assert (buy_fee, sell_fee) == (1.0, 2.0)
        assert buy_tax is None
        assert sell_tax == 0.10

    def test_costs_charged_per_line_stay_on_their_line(self):
        reading = _reading(
            [
                _line(side='V', quantity=10, price=100).model_copy(update={'fees': 0.35}),
                _line(side='V', quantity=10, price=100).model_copy(update={'fees': 0.0}),
            ],
            brokerage=1.0,
        )

        fees = [fee for fee, _ in allocate_costs(reading)]

        assert fees == [0.85, 0.5]


class TestCheckNote:
    def test_a_note_that_adds_up_raises_nothing(self):
        reading = _reading(
            [_line(side='C', quantity=100, price=30), _line(side='V', quantity=10, price=50)],
            operations_total=3500.0,
            emoluments=1.0,
            net_amount=500 - 3000 - 1.0,
        )

        assert check_note(reading) == []

    def test_a_misread_line_is_flagged(self):
        reading = _reading([_line(quantity=100, price=30, value=3100)])

        assert [w.code for w in check_note(reading)] == ['line_value']

    def test_a_missing_line_breaks_the_operations_total(self):
        reading = _reading([_line(quantity=100, price=30)], operations_total=4500.0)

        assert [w.code for w in check_note(reading)] == ['operations_total']

    def test_a_net_that_does_not_close_is_flagged(self):
        reading = _reading([_line(quantity=100, price=30)], brokerage=5.0, net_amount=-3000.0)

        assert [w.code for w in check_note(reading)] == ['net_amount']


class TestReconcileInDollars:
    def test_a_dollar_line_is_compared_with_the_dollar_price(self):
        # `price` é sempre em reais; a nota da Avenue imprime o preço em dólar.
        existing = [
            _transaction(1, 24.45205, 1500.0, price_usd=299.9923, fees=0.0, settlement_date=None)
        ]
        line = _note_line(
            quantity=24.45205, price=299.9923, fees=0.0, settlement_date=None, currency='USD'
        )

        (group,) = reconcile([line], existing)

        assert group.status == GroupStatus.UNCHANGED


class TestReconcile:
    def test_nothing_recorded_is_new(self):
        (group,) = reconcile([_note_line()], [])

        assert group.status == GroupStatus.NEW
        assert group.default_action == GroupAction.CREATE

    def test_same_lines_with_the_same_note_fields_are_unchanged(self):
        existing = [_transaction(1, 100, 30, fees=0.5, settlement_date=date(2026, 9, 3))]

        (group,) = reconcile([_note_line()], existing)

        assert group.status == GroupStatus.UNCHANGED
        assert group.actions == (GroupAction.SKIP,)

    def test_same_lines_missing_the_costs_are_updated_in_place(self):
        (group,) = reconcile([_note_line()], [_transaction(1, 100, 30)])

        assert group.status == GroupStatus.UPDATE
        assert [u.transaction_id for u in group.updates] == [1]

    def test_a_manual_aggregate_that_matches_is_replaced_by_the_executions(self):
        lines = [_note_line(0, quantity=60, price=29.90), _note_line(1, quantity=40, price=30.15)]
        average = (60 * 29.90 + 40 * 30.15) / 100

        (group,) = reconcile(lines, [_transaction(1, 100, round(average, 2))])

        assert group.status == GroupStatus.REPLACE
        assert group.default_action == GroupAction.REPLACE
        assert group.existing_ids == (1,)

    def test_a_different_quantity_is_a_conflict_skipped_by_default(self):
        (group,) = reconcile([_note_line(quantity=100)], [_transaction(1, 80, 30)])

        assert group.status == GroupStatus.CONFLICT
        assert group.default_action == GroupAction.SKIP
        assert set(group.actions) == {GroupAction.SKIP, GroupAction.REPLACE, GroupAction.CREATE}

    def test_the_same_trade_under_another_broker_is_a_conflict(self):
        existing = [_transaction(1, 100, 30, broker_id=OTHER_BROKER)]

        (group,) = reconcile([_note_line()], existing)

        assert group.status == GroupStatus.CONFLICT
        assert group.existing_ids == (1,)
        assert 'outra corretora' in group.message

    def test_a_sale_does_not_match_a_purchase(self):
        (group,) = reconcile([_note_line(side='V')], [_transaction(1, 100, 30)])

        assert group.status == GroupStatus.NEW

    def test_a_line_without_asset_is_unresolved(self):
        (group,) = reconcile([_note_line(asset_id=None)], [])

        assert group.status == GroupStatus.UNRESOLVED
        assert group.actions == (GroupAction.SKIP,)

    def test_a_sale_beyond_the_position_warns(self):
        existing = [_transaction(1, 50, 20, on=date(2026, 8, 1))]

        (group,) = reconcile([_note_line(side='V', quantity=80)], existing)

        assert group.status == GroupStatus.NEW
        (warning,) = group.warnings
        assert '-30' in warning

    def test_a_sale_covered_by_a_purchase_in_the_same_note_does_not_warn(self):
        groups = reconcile(
            [_note_line(0, side='C', quantity=80), _note_line(1, side='V', quantity=80)], []
        )

        assert all(not group.warnings for group in groups)
