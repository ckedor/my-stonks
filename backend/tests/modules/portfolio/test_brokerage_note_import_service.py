"""O import lê sem escrever, e só escreve sobre o cruzamento que a pessoa viu."""

from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ConflictError, ValidationError
from app.modules.market_data.domain.constants import CURRENCY
from app.modules.portfolio.domain.brokerage_note import (
    AssetMatch,
    GroupAction,
    GroupDecision,
    GroupStatus,
    NoteAmounts,
    NoteHeader,
    NoteLine,
)
from app.modules.portfolio.domain.entities import BrokerageNote, Transaction
from app.modules.portfolio.domain.outputs import (
    BrokerageNoteLineReading,
    BrokerageNoteReading,
    BrokerageNotesReading,
)
from app.modules.portfolio.service.brokerage_note_import_service import (
    BrokerageNoteImportService,
)
from tests.fakes import FakeUnitOfWork

PDF = b'%PDF-1.7 nota'
PREGAO = date(2026, 9, 1)
PORTFOLIO = 1
BROKER = 7
AVENUE = 2
QQQM = 59
PETR4 = 101


def _reading(**overrides) -> BrokerageNotesReading:
    note = {
        'broker_name': 'NU INVEST CORRETORA',
        'broker_cnpj': '62.169.875/0001-79',
        'currency': 'BRL',
        'note_number': '123',
        'trade_date': PREGAO,
        'settlement_date': date(2026, 9, 3),
        'lines': [
            BrokerageNoteLineReading(
                side='C',
                market='FRACIONARIO',
                security='PETR4F PN N2',
                ticker=None,
                quantity=10,
                price=30,
                value=300,
                fees=None,
            ),
            BrokerageNoteLineReading(
                side='C',
                market='VISTA',
                security='EMPRESA SEM CADASTRO ON',
                ticker=None,
                quantity=100,
                price=5,
                value=500,
                fees=None,
            ),
        ],
        'purchases_total': 800.0,
        'sales_total': None,
        'operations_total': 800.0,
        'settlement_fee': 0.2,
        'registration_fee': None,
        'emoluments': 0.04,
        'other_exchange_fees': None,
        'brokerage': None,
        'iss': None,
        'other_costs': None,
        'withheld_income_tax': None,
        'net_amount': -800.24,
    }
    return BrokerageNotesReading(notes=[BrokerageNoteReading(**(note | overrides))])


def _line(**overrides) -> NoteLine:
    fields = {
        'note_index': 0,
        'line_index': 0,
        'broker_id': BROKER,
        'asset_id': PETR4,
        'trade_date': PREGAO,
        'settlement_date': date(2026, 9, 3),
        'side': 'C',
        'quantity': 10.0,
        'price': 30.0,
        'fees': 0.09,
        'withheld_income_tax': None,
    }
    return NoteLine(**(fields | overrides))


def _transaction(id, quantity=10.0, price=30.0) -> Transaction:
    return Transaction(
        id=id,
        portfolio_id=PORTFOLIO,
        asset_id=PETR4,
        broker_id=BROKER,
        date=datetime(2026, 9, 1),
        quantity=quantity,
        price=price,
    )


NOTE = NoteHeader(
    broker_id=BROKER,
    currency='BRL',
    note_number='123',
    trade_date=PREGAO,
    settlement_date=date(2026, 9, 3),
    amounts=NoteAmounts(settlement_fee=0.2, emoluments=0.04, net_amount=-800.24),
)


def _service(*, existing=(), reading=None, imported=None):
    portfolios = SimpleNamespace(
        list_brokers=AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=BROKER,
                    name='Nu Investimentos',
                    cnpj='62.169.875/0001-79',
                    currency_id=CURRENCY.BRL,
                ),
                SimpleNamespace(
                    id=AVENUE, name='Avenue', cnpj='46.730.175/0001-55', currency_id=CURRENCY.USD
                ),
            ]
        ),
        get_asset_transactions_until=AsyncMock(return_value=list(existing)),
        find_brokerage_note=AsyncMock(return_value=imported),
        create=AsyncMock(return_value=[900]),
        update=AsyncMock(),
        delete=AsyncMock(),
    )
    assets = SimpleNamespace(
        get_by_tickers=AsyncMock(
            return_value=[
                SimpleNamespace(id=PETR4, ticker='PETR4', name='Petrobras'),
                SimpleNamespace(id=QQQM, ticker='QQQM', name='Invesco Nasdaq 100'),
            ]
        )
    )
    uow = FakeUnitOfWork(portfolios=portfolios, assets=assets)
    extractor = SimpleNamespace(
        extract=AsyncMock(return_value=(reading or _reading(), 'claude-sonnet-5'))
    )
    usd_brl = SimpleNamespace(
        get_rate_on_or_before=AsyncMock(
            return_value=SimpleNamespace(usd_brl=Decimal('5'), brl_usd=Decimal('0.2'))
        )
    )
    service = BrokerageNoteImportService(uow=uow, extractor=extractor, usd_brl_service=usd_brl)
    return service, uow


async def test_extraction_resolves_broker_and_asset_and_writes_nothing():
    service, uow = _service()

    draft = await service.extract(portfolio_id=PORTFOLIO, filename='nota.pdf', content=PDF)

    (note,) = draft.notes
    assert note.broker_id == BROKER
    assert note.warnings == ()
    petr4, unknown = note.lines
    assert (petr4.ticker, petr4.asset_id, petr4.match) == ('PETR4', PETR4, AssetMatch.MATCHED)
    assert unknown.match == AssetMatch.UNKNOWN
    assert petr4.fees + unknown.fees == pytest.approx(0.24)
    assert [group.status for group in note.groups] == [GroupStatus.NEW, GroupStatus.UNRESOLVED]
    assert note.imported_note_id is None
    uow.commit.assert_not_awaited()


async def test_an_unknown_broker_is_left_for_the_person_to_choose():
    service, uow = _service()
    uow.portfolios.list_brokers.return_value = []

    draft = await service.extract(portfolio_id=PORTFOLIO, filename='nota.pdf', content=PDF)

    (note,) = draft.notes
    assert note.broker_id is None
    assert [w.code for w in note.warnings] == ['broker_unknown']
    assert {group.status for group in note.groups} == {GroupStatus.UNRESOLVED}


async def test_a_file_that_is_not_a_pdf_never_reaches_the_model():
    service, _ = _service()

    with pytest.raises(ValidationError, match='não é um PDF'):
        await service.extract(portfolio_id=PORTFOLIO, filename='nota.pdf', content=b'oi')


async def test_creating_writes_the_note_fields_and_the_dollar_price():
    service, uow = _service()
    line = _line()
    key = f'{BROKER}:{PETR4}:{PREGAO.isoformat()}:C'

    result = await service.apply(
        portfolio_id=PORTFOLIO,
        note=NOTE,
        lines=[line],
        decisions=[GroupDecision(key=key, action=GroupAction.CREATE, existing_ids=())],
    )

    assert (result.note_id, result.created, result.asset_ids) == (900, 1, (PETR4,))
    (note_call, transactions_call) = uow.portfolios.create.await_args_list
    note_model, saved_note = note_call.args
    assert note_model is BrokerageNote
    assert (saved_note['note_number'], saved_note['emoluments']) == ('123', 0.04)
    _, (written,) = transactions_call.args
    assert written['brokerage_note_id'] == 900
    assert written['quantity'] == 10.0
    assert written['price_usd'] == pytest.approx(6.0)
    assert written['fees'] == 0.09
    assert written['settlement_date'] == date(2026, 9, 3)
    uow.commit.assert_awaited_once()


async def test_replace_deletes_what_was_seen_and_creates_the_lines():
    service, uow = _service(existing=[_transaction(55)])
    lines = [_line(line_index=0, quantity=6), _line(line_index=1, quantity=4)]
    key = f'{BROKER}:{PETR4}:{PREGAO.isoformat()}:C'

    result = await service.apply(
        portfolio_id=PORTFOLIO,
        note=NOTE,
        lines=lines,
        decisions=[GroupDecision(key=key, action=GroupAction.REPLACE, existing_ids=(55,))],
    )

    assert (result.created, result.deleted) == (2, 1)
    uow.portfolios.delete.assert_awaited_once_with(Transaction, id=55)


async def test_a_decision_over_transactions_that_changed_is_refused():
    # A pessoa viu o grupo vazio; alguém lançou a operação à mão enquanto isso.
    service, uow = _service(existing=[_transaction(55)])
    key = f'{BROKER}:{PETR4}:{PREGAO.isoformat()}:C'

    with pytest.raises(ConflictError):
        await service.apply(
            portfolio_id=PORTFOLIO,
            note=NOTE,
            lines=[_line()],
            decisions=[GroupDecision(key=key, action=GroupAction.CREATE, existing_ids=())],
        )

    uow.portfolios.create.assert_not_awaited()
    uow.commit.assert_not_awaited()


async def test_an_action_the_group_does_not_offer_is_refused():
    service, uow = _service()
    key = f'{BROKER}:{PETR4}:{PREGAO.isoformat()}:C'

    with pytest.raises(ValidationError):
        await service.apply(
            portfolio_id=PORTFOLIO,
            note=NOTE,
            lines=[_line()],
            decisions=[GroupDecision(key=key, action=GroupAction.REPLACE, existing_ids=())],
        )

    uow.commit.assert_not_awaited()


async def test_a_note_already_imported_is_flagged_and_updated_not_duplicated():
    previous = SimpleNamespace(id=42, imported_at=datetime(2026, 9, 2, 10, 0))
    service, uow = _service(imported=previous)

    draft = await service.extract(portfolio_id=PORTFOLIO, filename='nota.pdf', content=PDF)
    assert draft.notes[0].imported_note_id == 42

    result = await service.apply(portfolio_id=PORTFOLIO, note=NOTE, lines=[], decisions=[])

    assert result.note_id == 42
    uow.portfolios.create.assert_not_awaited()
    ((model, fields),) = [call.args for call in uow.portfolios.update.await_args_list]
    assert (model, fields['id']) == (BrokerageNote, 42)


async def test_a_note_without_broker_cannot_be_confirmed():
    service, uow = _service()

    with pytest.raises(ValidationError, match='corretora'):
        await service.apply(
            portfolio_id=PORTFOLIO,
            note=NoteHeader(**{**NOTE.__dict__, 'broker_id': None}),
            lines=[],
            decisions=[],
        )

    uow.commit.assert_not_awaited()


def _avenue_reading() -> BrokerageNotesReading:
    return BrokerageNotesReading(
        notes=[
            BrokerageNoteReading(
                broker_name='AVENUE SECURITIES LLC',
                broker_cnpj=None,
                currency='USD',
                note_number=None,
                trade_date=date(2026, 9, 21),
                settlement_date=date(2026, 9, 22),
                lines=[
                    BrokerageNoteLineReading(
                        side='V',
                        market=None,
                        security='INVESCO EXCHANGE TRADED FD TR II INVESCO NASDAQ 100 ETF',
                        ticker='QQQM',
                        quantity=24.45205,
                        price=299.9923,
                        value=7335.43,
                        fees=0.0,
                    )
                ],
                purchases_total=0.0,
                sales_total=7335.43,
                operations_total=None,
                settlement_fee=None,
                registration_fee=None,
                emoluments=None,
                other_exchange_fees=None,
                brokerage=None,
                iss=None,
                other_costs=None,
                withheld_income_tax=None,
                net_amount=None,
            )
        ]
    )


async def test_a_dollar_confirmation_finds_the_broker_by_name_and_the_us_ticker():
    service, _ = _service(reading=_avenue_reading())

    draft = await service.extract(portfolio_id=PORTFOLIO, filename='avenue.pdf', content=PDF)

    (note,) = draft.notes
    assert (note.broker_id, note.currency, note.warnings) == (AVENUE, 'USD', ())
    (line,) = note.lines
    assert (line.ticker, line.asset_id, line.match) == ('QQQM', QQQM, AssetMatch.MATCHED)


async def test_a_dollar_line_is_stored_with_the_real_price_from_the_day_rate():
    service, uow = _service()
    line = _line(
        broker_id=AVENUE, asset_id=QQQM, side='V', quantity=2.0, price=300.0, currency='USD'
    )
    key = f'{AVENUE}:{QQQM}:{PREGAO.isoformat()}:V'

    await service.apply(
        portfolio_id=PORTFOLIO,
        note=NoteHeader(**{**NOTE.__dict__, 'broker_id': AVENUE, 'currency': 'USD'}),
        lines=[line],
        decisions=[GroupDecision(key=key, action=GroupAction.CREATE, existing_ids=())],
    )

    note_call, transactions_call = uow.portfolios.create.await_args_list
    assert note_call.args[1]['currency'] == 'USD'
    _, (written,) = transactions_call.args
    assert (written['price_usd'], written['price'], written['quantity']) == (300.0, 1500.0, -2.0)


async def test_a_note_in_another_currency_than_its_broker_is_refused():
    service, uow = _service()

    with pytest.raises(ValidationError, match='outra moeda'):
        await service.apply(
            portfolio_id=PORTFOLIO,
            note=NoteHeader(**{**NOTE.__dict__, 'currency': 'USD'}),
            lines=[],
            decisions=[],
        )

    uow.commit.assert_not_awaited()
