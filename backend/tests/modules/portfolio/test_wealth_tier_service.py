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
async def test_the_tier_follows_the_patrimony_down():
    """A guarda da promessa: a patente é onde a carteira está, não onde esteve.

    A série sobe até Camponês e cai de volta abaixo de Andarilho. Ler o degrau
    do pico deixava o título falando de um mês e a barra de outro — "Camponês"
    com uma barra medindo a distância a partir de um patrimônio que a carteira
    já não tinha. É aqui que essa regressão apareceria, por isso a asserção é
    sobre a série caída.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_patrimony'] == 30_000.0
    assert standing['current_tier'].name == 'Pedinte'
    assert standing['next_tier'].name == 'Andarilho'


@pytest.mark.asyncio
async def test_the_peak_is_still_reported_but_does_not_decide_the_title():
    """O pico continua publicado — ele conta a história do álbum.

    O que ele não faz mais é escolher a patente: os 120k do topo ficam em
    `peak_patrimony`, e o título e o quanto falta saem os dois dos 30k de hoje,
    do mesmo número. Duas perguntas sobre a mesma carteira não podem ser
    respondidas a partir de dois patrimônios diferentes.
    """
    service, *_ = _build(_series(10_000.0, 120_000.0, 30_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['peak_patrimony'] == 120_000.0
    assert standing['current_patrimony'] == 30_000.0
    assert standing['remaining'] == 20_000.0


@pytest.mark.asyncio
async def test_progress_measures_the_crossing_from_the_current_rung():
    """A barra mede o trecho que o "Faltam" ao lado dela promete.

    Com 120k a carteira é Camponês (100k) a caminho de Mercador (200k): 20% da
    travessia, e não 60% do alvo cheio. Sobre o valor cheio, quem acabou de
    subir de degrau já apareceria quase no fim da barra.
    """
    service, *_ = _build(_series(30_000.0, 120_000.0))

    standing = await service.get_portfolio_tier(portfolio_id=1)

    assert standing['current_tier'].name == 'Camponês'
    assert standing['next_tier'].name == 'Mercador'
    assert standing['progress'] == pytest.approx(0.2)


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
