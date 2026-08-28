"""What a specialized screen is about, and how its numbers are read.

Three things are worth pinning here. The rule that puts a position on one
screen and not another -- it is the only place where "Brazilian" is decided,
and getting it wrong silently moves a holding between screens. That a segment
which is a whole asset type still reads the consolidated series instead of
recomputing it: the fallback works, so nothing would fail if that path quietly
stopped being taken. And that membership is by asset-type **id** -- the first
version matched `asset_type.short_name`, which is pt-BR product copy, so the
screens for `Ação`, `Tesouro` and `Cripto` came up empty while `FII` and `ETF`
worked by coincidence.
"""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.portfolio.domain.portfolio_segment import (
    SEGMENT_DEFINITIONS,
    UNSEGMENTED_ASSET_TYPES,
    PortfolioSegment,
    get_segment_definition,
    resolve_segment,
)
from app.modules.portfolio.domain.returns import calculate_portfolio_daily_returns
from app.modules.portfolio.service.portfolio_position_service import PortfolioPositionService
from tests.fakes import FakeCache, FakeUnitOfWork


@pytest.mark.unit
@pytest.mark.parametrize(
    ('asset_type', 'exchange', 'expected'),
    [
        (ASSET_TYPE.FII, 'B3', 'fii'),
        (ASSET_TYPE.STOCK, 'B3', 'equity-br'),
        (ASSET_TYPE.ETF, 'B3', 'equity-br'),
        (ASSET_TYPE.BDR, 'B3', 'equity-br'),
        (ASSET_TYPE.STOCK, 'NASDAQ', 'equity-world'),
        (ASSET_TYPE.ETF, 'NYSE', 'equity-world'),
        (ASSET_TYPE.REIT, 'NYSE', 'equity-world'),
        # Sem bolsa é brasileiro: é como o Tesouro e o CDB ficam registrados,
        # e é o mesmo padrão que o provedor usa para dizer que são cotados em
        # BRL. Uma ação sem bolsa cair no Mundo seria a leitura errada.
        (ASSET_TYPE.STOCK, None, 'equity-br'),
        (ASSET_TYPE.TREASURY, None, 'fixed-income'),
        (ASSET_TYPE.CDB, None, 'fixed-income'),
        (ASSET_TYPE.DEB, None, 'fixed-income'),
        (ASSET_TYPE.LCA, None, 'fixed-income'),
        (ASSET_TYPE.CRIPTO, None, 'crypto'),
        # Nem toda posição está numa tela especializada, e isso é permitido.
        (ASSET_TYPE.PREV, None, None),
        (ASSET_TYPE.FI, None, None),
        (None, 'B3', None),
    ],
)
def test_resolve_segment_reads_the_asset_type_and_the_market(asset_type, exchange, expected):
    assert resolve_segment(asset_type, exchange) == expected


@pytest.mark.unit
def test_every_asset_type_is_either_in_a_segment_or_deliberately_out():
    """A guarda que faltava quando as telas vieram vazias.

    O primeiro corte casava `asset_type.short_name` -- rótulo em pt-BR -- com
    um código em inglês, e acertava só onde os dois coincidiam: `Ação`,
    `Tesouro`, `Debênture` e `Cripto` ficavam de fora sem que nada falhasse.
    Aqui cada tipo é cobrado por id, então um tipo novo, ou um id trocado,
    reprova em vez de sumir de tela.
    """
    in_segments = {
        asset_type
        for definition in SEGMENT_DEFINITIONS.values()
        for asset_type in definition.asset_types
    }

    assert in_segments | set(UNSEGMENTED_ASSET_TYPES) == set(ASSET_TYPE)
    assert in_segments.isdisjoint(UNSEGMENTED_ASSET_TYPES)


@pytest.mark.unit
def test_a_position_belongs_to_at_most_one_segment():
    for asset_type in ASSET_TYPE:
        for exchange in ('B3', None, 'NASDAQ'):
            matches = [
                segment
                for segment in PortfolioSegment
                if resolve_segment(asset_type, exchange) == segment.value
            ]
            assert len(matches) <= 1, (asset_type, exchange, matches)


@pytest.mark.unit
def test_only_a_whole_asset_type_can_read_the_consolidated_series():
    whole = {
        segment
        for segment in PortfolioSegment
        if get_segment_definition(segment).is_whole_asset_type
    }
    assert whole == {PortfolioSegment.FII, PortfolioSegment.CRYPTO}


def _position_history() -> list[dict]:
    rows = []
    for day, br_price, world_price in (
        ('2025-01-02', 100.0, 20.0),
        ('2025-07-02', 110.0, 22.0),
        ('2026-01-02', 121.0, 19.8),
    ):
        rows.extend([
            {
                'date': day,
                'asset_id': 10,
                'asset_type_id': int(ASSET_TYPE.STOCK),
                'ticker': 'ACAO3',
                'quantity': 10.0,
                'price': br_price,
                'price_usd': br_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
            {
                'date': day,
                'asset_id': 20,
                'asset_type_id': int(ASSET_TYPE.STOCK),
                'ticker': 'AAPL',
                'quantity': 10.0,
                'price': world_price,
                'price_usd': world_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
        ])
    return rows


def _service(**repository_methods) -> PortfolioPositionService:
    repository = SimpleNamespace(**repository_methods)
    return PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=FakeCache(),
    )


@pytest.mark.unit
async def test_whole_asset_type_segment_reads_the_consolidated_series():
    stored = [
        {
            'date': pd.Timestamp('2026-01-02'),
            'asset_type_id': int(ASSET_TYPE.FII),
            'asset_type': 'FII',
            'daily_return': 0.01,
            'acc_return': 0.21,
            'cagr': 0.21,
        }
    ]
    service = _service(
        get_asset_type_returns=AsyncMock(return_value=stored),
        get_segment_asset_ids=AsyncMock(),
        get_portfolio_position=AsyncMock(),
    )

    result = await service.get_segment_returns(7, PortfolioSegment.FII)

    assert result[-1]['acc_return'] == pytest.approx(0.21)
    # O id vem da constante, e não de uma busca pelo rótulo do tipo.
    service.uow.portfolios.get_asset_type_returns.assert_awaited_once_with(
        7, int(ASSET_TYPE.FII), 'BRL'
    )
    service.uow.portfolios.get_segment_asset_ids.assert_not_awaited()


@pytest.mark.unit
async def test_segment_cut_by_market_is_calculated_over_the_assets_it_covers():
    covered = [row for row in _position_history() if row['asset_id'] == 10]
    service = _service(
        get_segment_asset_ids=AsyncMock(return_value=[10]),
        get_portfolio_position=AsyncMock(return_value=covered),
        get_asset_type_returns=AsyncMock(),
    )

    result = await service.get_segment_returns(7, PortfolioSegment.EQUITY_BR)

    service.uow.portfolios.get_portfolio_position.assert_awaited_once_with(7, asset_ids=[10])
    service.uow.portfolios.get_asset_type_returns.assert_not_awaited()
    assert result[-1]['date'] == '2026-01-02'
    assert result[-1]['acc_return'] == pytest.approx(0.21)


@pytest.mark.unit
async def test_a_segment_nobody_holds_answers_with_nothing():
    service = _service(
        get_segment_asset_ids=AsyncMock(return_value=[]),
        get_portfolio_position=AsyncMock(),
    )

    assert await service.get_segment_returns(7, PortfolioSegment.EQUITY_WORLD) == []
    service.uow.portfolios.get_portfolio_position.assert_not_awaited()


@pytest.mark.unit
async def test_empty_segment_patrimony_is_nothing_and_not_the_whole_portfolio():
    """A lista vazia cairia fora do filtro `if asset_ids:` do repositório."""
    service = _service(
        get_segment_asset_ids=AsyncMock(return_value=[]),
        get_portfolio_position=AsyncMock(return_value=_position_history()),
    )

    result = await service.compute_patrimony_evolution(7, segment=PortfolioSegment.EQUITY_WORLD)

    assert result is None
    service.uow.portfolios.get_portfolio_position.assert_not_awaited()


@pytest.mark.unit
def test_weighted_returns_ignores_positions_outside_the_segment():
    """A conta é a mesma da carteira inteira, sobre um subconjunto."""
    service = PortfolioPositionService(
        FakeUnitOfWork(), market_data_service=SimpleNamespace(), cache=FakeCache()
    )
    everything = _position_history()
    only_world = [row for row in everything if row['asset_id'] == 20]

    whole = service._weighted_returns(everything)
    segment = service._weighted_returns(only_world)

    assert segment[-1]['acc_return'] == pytest.approx(-0.01)
    assert whole[-1]['acc_return'] != pytest.approx(segment[-1]['acc_return'])
    # A série completa continua sendo a que o consolidador escreve.
    assert calculate_portfolio_daily_returns(pd.DataFrame(everything)).shape[0] == 6


@pytest.mark.unit
@pytest.mark.parametrize(
    ('segment', 'scoped_by_market'),
    [
        (PortfolioSegment.FII, False),
        (PortfolioSegment.FIXED_INCOME, False),
        (PortfolioSegment.CRYPTO, False),
        (PortfolioSegment.EQUITY_BR, True),
        (PortfolioSegment.EQUITY_WORLD, True),
    ],
)
async def test_only_the_market_scoped_segments_filter_by_exchange(segment, scoped_by_market):
    """A consulta que separa o que está em cada tela.

    Ela filtra por `asset.asset_type_id` -- o id semeado -- e nunca pelo
    `short_name`, que é rótulo. E a fronteira do mercado é o único lugar onde
    "brasileiro" vira SQL: errar ali não quebra nada, move a posição de tela
    em silêncio. Por isso o teste lê a consulta.
    """
    from app.infra.db.bootstrap import start_mappers
    from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository

    start_mappers()
    repository = PortfolioRepository.__new__(PortfolioRepository)
    result = SimpleNamespace(all=lambda: [])
    repository.session = SimpleNamespace(execute=AsyncMock(return_value=result))

    await repository.get_segment_asset_ids(7, get_segment_definition(segment))

    statement = repository.session.execute.await_args.args[0]
    sql = ' '.join(str(statement.compile()).split())
    parameters = statement.compile().params

    assert 'asset.asset.asset_type_id IN' in sql
    assert 'short_name' not in sql
    assert set(parameters['asset_type_id_1']) == set(get_segment_definition(segment).asset_type_ids)
    # Sem bolsa é brasileiro, e é o `IS NULL` que diz isso.
    assert ('exchange.code = ' in sql and 'exchange_id IS NULL' in sql) is scoped_by_market
    # O Mundo é o complemento do Brasil, e não uma segunda lista de bolsas.
    assert ('NOT (' in sql) is (segment is PortfolioSegment.EQUITY_WORLD)


def _current_position_row(asset_id: int, type_id: int, exchange: str | None) -> dict:
    """Uma linha como `get_position_on_date` devolve."""
    return {
        'date': '2026-03-17',
        'asset_id': asset_id,
        'ticker': f'A{asset_id}',
        'name': f'Ativo {asset_id}',
        'quantity': 10,
        'price': 100.0,
        'twelve_months_return': 0.1,
        'acc_return': 0.2,
        'daily_return': 0.001,
        'cagr': 0.1,
        'total_invested': 900.0,
        'dividend': None,
        'category': 'Alguma',
        'type': 'rótulo',
        'type_id': type_id,
        'class': 'classe',
        'exchange': exchange,
    }


@pytest.mark.unit
async def test_the_current_position_payload_carries_the_segment():
    """O que a tela especializada lê, e o que faltava.

    O cálculo do segmento nasceu no método errado -- o histórico de um ativo,
    e não a posição atual, que é a resposta de `/portfolio/position/{id}` que
    toda tela consome. A consulta do histórico nem traz a bolsa, então a
    guarda `if 'exchange' in columns` transformou o engano em silêncio: nada
    falhava, e as cinco telas abriam vazias. Este teste é sobre a resposta,
    não sobre o método, justamente por isso.
    """
    rows = [
        _current_position_row(1, ASSET_TYPE.STOCK, None),
        _current_position_row(2, ASSET_TYPE.STOCK, 'NASDAQ'),
        _current_position_row(3, ASSET_TYPE.FII, 'B3'),
        _current_position_row(4, ASSET_TYPE.CRIPTO, None),
        _current_position_row(5, ASSET_TYPE.TREASURY, None),
        _current_position_row(6, ASSET_TYPE.PREV, None),
    ]
    service = _service(get_position_on_date=AsyncMock(return_value=rows))

    response = await service.get_portfolio_position(1)
    payload = json.loads(bytes(response.body))

    assert [row['segment'] for row in payload] == [
        'equity-br',
        'equity-world',
        'fii',
        'crypto',
        'fixed-income',
        # Previdência não tem tela, e nulo é a resposta honesta.
        None,
    ]


@pytest.mark.unit
async def test_the_by_broker_view_has_no_segment_and_does_not_break():
    """Ela é outra consulta, para a declaração de IR: não traz bolsa."""
    rows = [
        {
            key: value
            for key, value in _current_position_row(1, ASSET_TYPE.STOCK, None).items()
            if key != 'exchange'
        }
    ]
    service = _service(get_position_on_date_by_broker=AsyncMock(return_value=rows))

    response = await service.get_portfolio_position(1, group_by_broker=True)
    payload = json.loads(bytes(response.body))

    assert 'segment' not in payload[0]
