"""What a specialized screen is about, and how its numbers are read.

Two things are worth pinning here. The first is the rule that puts a position
on one screen and not another -- it is the only place where "Brazilian" is
decided, and getting it wrong silently moves a holding between screens. The
second is that a segment which is a whole asset type still reads the
consolidated series instead of recomputing it: the fallback works, so nothing
would fail if that path quietly stopped being taken.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.portfolio.domain.portfolio_segment import (
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
        ('FII', 'B3', 'fii'),
        ('STOCK', 'B3', 'equity-br'),
        ('ETF', 'B3', 'equity-br'),
        ('BDR', 'B3', 'equity-br'),
        ('STOCK', 'NASDAQ', 'equity-world'),
        ('ETF', 'NYSE', 'equity-world'),
        ('REIT', 'NYSE', 'equity-world'),
        # Sem bolsa é brasileiro: é como o Tesouro e o CDB ficam registrados,
        # e é o mesmo padrão que o provedor usa para dizer que são cotados em
        # BRL. Uma ação sem bolsa cair no Mundo seria a leitura errada.
        ('STOCK', None, 'equity-br'),
        ('TREASURY', None, 'fixed-income'),
        ('CDB', None, 'fixed-income'),
        ('LCA', None, 'fixed-income'),
        ('CRIPTO', None, 'crypto'),
        # Nem toda posição está numa tela especializada, e isso é permitido.
        ('PREV', None, None),
        ('FI', None, None),
        (None, 'B3', None),
    ],
)
def test_resolve_segment_reads_the_asset_type_and_the_market(asset_type, exchange, expected):
    assert resolve_segment(asset_type, exchange) == expected


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
                'asset_type_id': 4,
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
                'asset_type_id': 4,
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
            'asset_type_id': 2,
            'asset_type': 'FII',
            'daily_return': 0.01,
            'acc_return': 0.21,
            'cagr': 0.21,
        }
    ]
    service = _service(
        get_asset_type_id=AsyncMock(return_value=2),
        get_asset_type_returns=AsyncMock(return_value=stored),
        get_segment_asset_ids=AsyncMock(),
        get_portfolio_position=AsyncMock(),
    )

    result = await service.get_segment_returns(7, PortfolioSegment.FII)

    assert result[-1]['acc_return'] == pytest.approx(0.21)
    service.uow.portfolios.get_segment_asset_ids.assert_not_awaited()


@pytest.mark.unit
async def test_segment_cut_by_market_is_calculated_over_the_assets_it_covers():
    covered = [row for row in _position_history() if row['asset_id'] == 10]
    service = _service(
        get_segment_asset_ids=AsyncMock(return_value=[10]),
        get_portfolio_position=AsyncMock(return_value=covered),
        get_asset_type_id=AsyncMock(),
    )

    result = await service.get_segment_returns(7, PortfolioSegment.EQUITY_BR)

    service.uow.portfolios.get_portfolio_position.assert_awaited_once_with(7, asset_ids=[10])
    service.uow.portfolios.get_asset_type_id.assert_not_awaited()
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
    """A cláusula que decide de que lado da fronteira um papel está.

    É o único lugar onde "brasileiro" vira SQL, e errar aqui não quebra nada:
    move a posição de tela em silêncio. Por isso o teste lê a consulta.
    """
    from app.infra.db.bootstrap import start_mappers
    from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository

    start_mappers()
    repository = PortfolioRepository.__new__(PortfolioRepository)
    result = SimpleNamespace(all=lambda: [])
    repository.session = SimpleNamespace(execute=AsyncMock(return_value=result))

    await repository.get_segment_asset_ids(7, get_segment_definition(segment))

    sql = ' '.join(str(repository.session.execute.await_args.args[0].compile()).split())
    # Sem bolsa é brasileiro, e é o `IS NULL` que diz isso.
    assert ('exchange.code = ' in sql and 'exchange_id IS NULL' in sql) is scoped_by_market
    # O Mundo é o complemento do Brasil, e não uma segunda lista de bolsas.
    assert ('NOT (' in sql) is (segment is PortfolioSegment.EQUITY_WORLD)
