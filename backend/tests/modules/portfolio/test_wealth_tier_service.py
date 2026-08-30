from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.portfolio.domain.wealth_tier_ladder import LADDER as REAL_LADDER
from app.modules.portfolio.domain.wealth_tier_ladder import WealthTier
from app.modules.portfolio.service.portfolio_wealth_tier_service import (
    PortfolioWealthTierService,
)

LADDER = [
    WealthTier(rank=1, name='Pedinte', threshold=0.0),
    WealthTier(rank=2, name='Andarilho', threshold=50_000.0),
    WealthTier(rank=3, name='Camponês', threshold=100_000.0),
    WealthTier(rank=4, name='Mercador', threshold=200_000.0),
]


def _build(evolution=None, tiers=None, returns=None):
    """A service over a short, readable ladder and a fixed patrimony series."""
    position_service = SimpleNamespace(
        get_patrimony_evolution=AsyncMock(return_value=evolution),
        get_portfolio_returns=AsyncMock(return_value=returns or []),
    )
    service = PortfolioWealthTierService(
        position_service=position_service,
        ladder=list(LADDER if tiers is None else tiers),
    )
    return service, None, None, position_service


def _series(*values):
    return [{'date': f'2025-01-{i + 1:02d}', 'portfolio': v} for i, v in enumerate(values)]


def test_the_real_ladder_climbs_without_ties():
    """A escala é a ordem em que a galeria é percorrida, e é fixa em código.

    Um limiar repetido ou fora de ordem tornaria ambíguo justamente o ponto
    onde ela é lida — que degrau um pico alcança —, e desalinharia cada cenário
    do degrau para o qual foi desenhado. É barato provar que não aconteceu.
    """
    ranks = [tier.rank for tier in REAL_LADDER]
    thresholds = [tier.threshold for tier in REAL_LADDER]

    assert ranks == list(range(1, len(REAL_LADDER) + 1))
    assert thresholds == sorted(set(thresholds))
    assert len({tier.name for tier in REAL_LADDER}) == len(REAL_LADDER)


@pytest.mark.asyncio
async def test_a_portfolio_at_its_peak_reads_the_same_either_way():
    service, *_ = _build(_series(10_000.0, 60_000.0, 120_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 120_000.0
    assert standing['current_patrimony'] == 120_000.0
    assert standing['current_tier'].name == 'Camponês'
    assert standing['next_tier'].name == 'Mercador'
    assert standing['remaining'] == 80_000.0


@pytest.mark.asyncio
async def test_a_tier_survives_the_patrimony_falling_back_below_its_threshold():
    """The guard on the whole promise: a rung is reached once and never lost.

    The series peaks inside Camponês and then falls back under Andarilho. If the
    tier were ever read from the latest value instead of the peak, this is where
    it would regress, so the assertion is on the fallen series, not the peak.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 120_000.0
    assert standing['current_tier'].name == 'Camponês'


@pytest.mark.asyncio
async def test_what_is_left_to_climb_is_measured_from_today_not_from_the_peak():
    """The other half of the split, and the reason the two numbers both exist.

    The peak of 120k earns Camponês, but the carteira is worth 30k today. The
    distance to Mercador is the one the portfolio actually has to cover from
    where it stands — 170k, not the 80k it would owe from its high.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_patrimony'] == 30_000.0
    assert standing['remaining'] == 170_000.0


@pytest.mark.asyncio
async def test_a_portfolio_below_its_own_rung_shows_an_empty_bar():
    """Falling under the floor of a rung already won is not negative progress."""
    service, *_ = _build(_series(120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Camponês'
    assert standing['progress'] == 0.0


@pytest.mark.asyncio
async def test_an_empty_portfolio_sits_on_the_lowest_rung():
    service, *_ = _build(None)

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 0.0
    assert standing['current_patrimony'] == 0.0
    assert standing['current_tier'].name == 'Pedinte'
    assert standing['next_tier'].name == 'Andarilho'
    assert standing['progress'] == 0.0


@pytest.mark.asyncio
async def test_the_top_rung_has_no_next_and_is_fully_progressed():
    service, *_ = _build(_series(500_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Mercador'
    assert standing['next_tier'] is None
    assert standing['remaining'] is None
    assert standing['progress'] == 1.0


@pytest.mark.asyncio
async def test_progress_is_measured_across_the_current_rung_only():
    service, *_ = _build(_series(75_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    # Halfway from Andarilho (50k) to Camponês (100k), not 75% of the way to 100k.
    assert standing['progress'] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_the_peak_is_read_in_brl_whatever_the_user_is_looking_at():
    service, _, _, position_service = _build(_series(1.0))

    await service.get_portfolio_tier(portfolio_id=7)

    # Toda leitura da série, e não só a primeira: a projeção lê a mesma
    # evolução para tirar a média de aporte, e uma delas em outra moeda faria
    # a patente e a distância até a próxima virem de histórias diferentes.
    assert position_service.get_patrimony_evolution.await_args_list
    for call in position_service.get_patrimony_evolution.await_args_list:
        assert call.args == (7,)
        assert call.kwargs == {'currency': 'BRL'}


@pytest.mark.asyncio
async def test_gaps_in_the_series_do_not_break_the_reading():
    """A missing tail value must not read as a carteira worth nothing today."""
    service, *_ = _build([
        {'date': '2025-01-01', 'portfolio': 60_000.0},
        {'date': '2025-01-02', 'portfolio': None},
        {'date': '2025-01-03'},
    ])

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 60_000.0
    assert standing['current_patrimony'] == 60_000.0


# ── A projeção ───────────────────────────────────────────────────


def _aported(*pairs):
    """A evolução como a projeção a lê: data e aporte acumulado."""
    return [{'date': date, 'portfolio': 100_000.0, 'acc_aported': value} for date, value in pairs]


@pytest.mark.asyncio
async def test_the_annual_rate_is_the_cagr_as_stored():
    """O CAGR é fração, e é lido como fração.

    O consolidador escreve 0.2586 para 25,86%, que é como a tela de
    rentabilidade o lê antes de multiplicar por cem. Uma divisão por cem aqui
    devolvia 0,3% ao ano e empurrava a data da próxima patente anos à frente,
    contradizendo o número que o resumo mostra.
    """
    service, *_ = _build(
        _aported(('2024-01-01', 0.0), ('2025-01-01', 12_000.0)),
        returns=[{'date': '2025-01-01', 'cagr': 0.2586}],
    )

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['projection']['annual_rate'] == pytest.approx(0.2586)


@pytest.mark.asyncio
async def test_the_contribution_average_spans_the_whole_history():
    """Doze mil em doze meses é mil por mês, e a janela é a história inteira.

    A média saía de uma janela curta, e com ela a data da próxima patente
    pulava a cada semestre bom ou ruim. A projeção fala de anos: o ritmo que
    ela usa é o de sempre, medido entre as duas pontas da série.
    """
    service, *_ = _build(
        _aported(('2024-01-01', 0.0), ('2024-07-01', 11_000.0), ('2025-01-01', 12_000.0)),
        returns=[],
    )

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['projection']['monthly_contribution'] == pytest.approx(1_000.0)


@pytest.mark.asyncio
async def test_no_projection_when_the_pace_never_gets_there():
    """Sem aporte e sem rendimento, a próxima patente não chega.

    Melhor não dizer data nenhuma do que dizer uma que o próprio cálculo não
    sustenta.
    """
    service, *_ = _build(
        _aported(('2024-01-01', 0.0), ('2025-01-01', 0.0)),
        returns=[],
    )

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['projection'] is None
