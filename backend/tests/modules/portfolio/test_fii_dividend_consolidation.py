"""What the FII dividend job records, and what it refuses to.

Two rules meet here. A payment is income only when the fund says so -- the job
used to read a source that published no label, so every amortization of capital
landed in the portfolio as income. And a payment belongs to whoever held the
shares on its **ex date**, not on the day the cash arrived: those are different
days, and the position series stops at a full exit, so reading the quantity on
the payment date paid a seller nothing at all.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.fii import FIIDividend
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from tests.fakes import FakeUnitOfWork

EX_DAY = pd.Timestamp.now().normalize() - pd.DateOffset(days=10)
PAYMENT_DAY = EX_DAY + pd.DateOffset(days=5)


def _payment(value_per_share: float, *, event_type: str | None = None) -> FIIDividend:
    return FIIDividend(
        payment_date=PAYMENT_DAY.date(),
        ex_date=EX_DAY.date(),
        value_per_share=value_per_share,
        event_type=event_type,
    )


def _positions(days: list[pd.Timestamp], quantity: float = 10.0) -> list[dict]:
    """One FII position row per day given, all of the same fund."""
    return [
        {
            'date': day,
            'asset_id': 10,
            'asset_type_id': 2,
            'ticker': 'FIIX11',
            'quantity': quantity,
            'price': 100.0,
            'price_usd': 20.0,
            'dividend': 0.0,
            'dividend_usd': 0.0,
        }
        for day in days
    ]


HELD_THROUGHOUT = [EX_DAY - pd.DateOffset(days=1), EX_DAY, PAYMENT_DAY]


def _service(
    payments: list[FIIDividend],
    positions: list[dict] | None = None,
    recorded: list | None = None,
):
    repository = SimpleNamespace(
        get=AsyncMock(
            side_effect=[
                SimpleNamespace(enabled=True),  # a configuração da integração
                recorded if recorded is not None else [],  # proventos já lançados
            ]
        ),
        get_portfolio_position=AsyncMock(
            return_value=positions if positions is not None else _positions(HELD_THROUGHOUT)
        ),
        create=AsyncMock(),
    )
    service = PortfolioConsolidatorService(
        uow=FakeUnitOfWork(portfolios=repository),
        provider=SimpleNamespace(fetch_fii_dividends=AsyncMock(return_value={'FIIX11': payments})),
        usd_brl_service=SimpleNamespace(),
    )
    return service, repository


def _recorded(repository) -> list[dict]:
    return [call.args[1] for call in repository.create.await_args_list]


@pytest.mark.asyncio
async def test_a_payment_is_recorded_on_the_day_it_was_paid():
    service, repository = _service([_payment(0.09, event_type='RENDIMENTO')])

    await service.consolidate_fii_dividends(7)

    recorded = _recorded(repository)
    assert len(recorded) == 1
    assert recorded[0]['portfolio_id'] == 7
    assert recorded[0]['asset_id'] == 10
    assert recorded[0]['date'] == PAYMENT_DAY
    # Dez cotas a 0,09 — o valor por cota vem publicado, nunca derivado do yield.
    assert recorded[0]['amount'] == pytest.approx(0.9)


@pytest.mark.asyncio
async def test_selling_after_the_ex_date_still_earns_the_payment():
    """O motivo de a quantidade sair da data-com.

    A série de posições para na saída total, então no dia do pagamento não há
    linha nenhuma — e ler a quantidade ali pagava zero a quem tinha direito.
    """
    service, repository = _service(
        [_payment(0.09)],
        positions=_positions([EX_DAY - pd.DateOffset(days=1), EX_DAY]),
    )

    await service.consolidate_fii_dividends(7)

    recorded = _recorded(repository)
    assert len(recorded) == 1
    assert recorded[0]['amount'] == pytest.approx(0.9)
    assert recorded[0]['date'] == PAYMENT_DAY


@pytest.mark.asyncio
async def test_buying_after_the_ex_date_earns_nothing():
    """O outro lado da mesma regra: chegou depois, não tinha direito."""
    service, repository = _service(
        [_payment(0.09)],
        positions=_positions([PAYMENT_DAY - pd.DateOffset(days=1), PAYMENT_DAY]),
    )

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_quantity_is_the_one_held_on_the_ex_date():
    """Vendeu metade depois da data-com: recebe pelo que tinha lá, não aqui."""
    positions = _positions([EX_DAY], quantity=10.0) + _positions([PAYMENT_DAY], quantity=4.0)
    service, repository = _service([_payment(0.09)], positions=positions)

    await service.consolidate_fii_dividends(7)

    assert _recorded(repository)[0]['amount'] == pytest.approx(0.9)


@pytest.mark.asyncio
async def test_an_amortization_is_not_a_dividend():
    """O bug que a fonte antiga não tinha como evitar: ela não publicava rótulo."""
    service, repository = _service([_payment(1.5, event_type='AMORTIZACAO')])

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_unlabelled_payment_still_counts_as_income():
    """Muitos fundos não preenchem o rótulo, e descartá-los esvaziaria a série."""
    service, repository = _service([_payment(0.09)])

    await service.consolidate_fii_dividends(7)

    assert len(_recorded(repository)) == 1


@pytest.mark.asyncio
async def test_a_payment_already_recorded_is_not_recorded_again():
    """Vale para o lançamento à mão e para a corrida de ontem."""
    service, repository = _service(
        [_payment(0.09)],
        recorded=[SimpleNamespace(asset_id=10, date=PAYMENT_DAY.date())],
    )

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_two_payments_on_the_same_day_are_one_dividend():
    """São dois eventos, e a carteira recebe um valor só naquele dia."""
    service, repository = _service([_payment(0.09), _payment(0.05, event_type='RENDIMENTO')])

    await service.consolidate_fii_dividends(7)

    recorded = _recorded(repository)
    assert len(recorded) == 1
    assert recorded[0]['amount'] == pytest.approx(1.4)


@pytest.mark.asyncio
async def test_a_fund_that_publishes_no_ex_date_falls_back_to_the_payment_date():
    service, repository = _service([
        FIIDividend(payment_date=PAYMENT_DAY.date(), value_per_share=0.09)
    ])

    await service.consolidate_fii_dividends(7)

    assert _recorded(repository)[0]['amount'] == pytest.approx(0.9)


@pytest.mark.asyncio
async def test_a_portfolio_without_the_integration_configured_is_skipped():
    """Ler `.enabled` de None levantava e derrubava as carteiras seguintes."""
    service, repository = _service([])
    repository.get = AsyncMock(return_value=None)

    await service.consolidate_fii_dividends(7)

    repository.get_portfolio_position.assert_not_awaited()
    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_fund_the_provider_reports_nothing_for_records_nothing():
    service, repository = _service([])

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_payment_older_than_the_window_is_left_alone():
    """A janela é dos pagamentos; as posições vão mais para trás só por causa
    da data-com, e não para reler a história inteira toda madrugada."""
    old_day = pd.Timestamp.now().normalize() - pd.DateOffset(days=200)
    service, repository = _service(
        [FIIDividend(payment_date=old_day.date(), ex_date=old_day.date(), value_per_share=0.09)],
        positions=_positions([old_day]),
    )

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()
