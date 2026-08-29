"""What the FII dividend job records, and what it refuses to.

The job used to scrape a source that published no event label, so every
amortization of capital landed in the portfolio as income -- a payment that
returns principal, counted as a return. `/v2/fii/dividends` publishes the
label, and `docs/domain.md` says the two are kept apart rather than summed;
these tests are what keeps them apart.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.fii import FIIDividend
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)
from tests.fakes import FakeUnitOfWork

PAYMENT_DAY = '2026-08-14'


def _positions(dividend_already_recorded: float = 0.0) -> list[dict]:
    """One FII position per day, ten shares, across the payment date."""
    return [
        {
            'date': day,
            'asset_id': 10,
            'asset_type_id': 2,
            'ticker': 'FIIX11',
            'quantity': 10.0,
            'price': 100.0,
            'price_usd': 20.0,
            'dividend': dividend_already_recorded if day == PAYMENT_DAY else 0.0,
            'dividend_usd': 0.0,
        }
        for day in ('2026-08-13', PAYMENT_DAY, '2026-08-15')
    ]


def _service(payments: list[FIIDividend], positions: list[dict] | None = None):
    repository = SimpleNamespace(
        get=AsyncMock(return_value=SimpleNamespace(enabled=True)),
        get_portfolio_position=AsyncMock(
            return_value=positions if positions is not None else _positions()
        ),
        create=AsyncMock(),
    )
    uow = FakeUnitOfWork(portfolios=repository)
    service = PortfolioConsolidatorService(
        uow=uow,
        provider=SimpleNamespace(
            fetch_fii_dividends=AsyncMock(return_value={'FIIX11': payments})
        ),
        usd_brl_service=SimpleNamespace(),
    )
    return service, repository


def _recorded(repository) -> list[dict]:
    return [call.args[1] for call in repository.create.await_args_list]


@pytest.mark.asyncio
async def test_an_income_payment_is_recorded_against_the_position_of_the_day():
    service, repository = _service([
        FIIDividend(
            payment_date=date(2026, 8, 14),
            value_per_share=0.09,
            event_type='RENDIMENTO',
        )
    ])

    await service.consolidate_fii_dividends(7)

    recorded = _recorded(repository)
    assert len(recorded) == 1
    assert recorded[0]['asset_id'] == 10
    assert recorded[0]['portfolio_id'] == 7
    # Dez cotas a 0,09 — o valor por cota vem publicado, nunca derivado do yield.
    assert recorded[0]['amount'] == pytest.approx(0.9)
    assert recorded[0]['date'] == pd.Timestamp(PAYMENT_DAY)


@pytest.mark.asyncio
async def test_an_amortization_is_not_a_dividend():
    """O bug que a fonte antiga não tinha como evitar: ela não publicava rótulo."""
    service, repository = _service([
        FIIDividend(
            payment_date=date(2026, 8, 14),
            value_per_share=1.5,
            event_type='AMORTIZACAO',
        )
    ])

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_unlabelled_payment_still_counts_as_income():
    """Muitos fundos não preenchem o rótulo, e descartá-los esvaziaria a série."""
    service, repository = _service([
        FIIDividend(payment_date=date(2026, 8, 14), value_per_share=0.09)
    ])

    await service.consolidate_fii_dividends(7)

    assert len(_recorded(repository)) == 1


@pytest.mark.asyncio
async def test_a_dividend_entered_by_hand_wins_over_the_provider():
    service, repository = _service(
        [FIIDividend(payment_date=date(2026, 8, 14), value_per_share=0.09)],
        positions=_positions(dividend_already_recorded=1.23),
    )

    await service.consolidate_fii_dividends(7)

    repository.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_two_payments_on_the_same_day_are_one_dividend():
    """São dois eventos, e a posição daquele dia recebeu os dois."""
    service, repository = _service([
        FIIDividend(payment_date=date(2026, 8, 14), value_per_share=0.09),
        FIIDividend(
            payment_date=date(2026, 8, 14), value_per_share=0.05, event_type='RENDIMENTO'
        ),
    ])

    await service.consolidate_fii_dividends(7)

    recorded = _recorded(repository)
    assert len(recorded) == 1
    assert recorded[0]['amount'] == pytest.approx(1.4)


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
