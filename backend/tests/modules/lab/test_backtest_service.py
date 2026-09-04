"""A orquestração da simulação: de onde vem o preço, e quantas vezes.

O motor já é testado sozinho. O que se prova aqui é o que só o serviço sabe:
que um ativo sem histórico persistido cai no provedor, que comparar N carteiras
não busca preço N vezes, e que a análise sempre carrega o CDI.
"""

from types import SimpleNamespace

import pandas as pd
import pytest

from app.modules.lab.domain.commands import (
    CompareBacktestsCommand,
    RunBacktestCommand,
    TheoreticalPositionCommand,
)
from app.modules.lab.domain.enums import Frequency
from app.modules.lab.service.backtest_service import BacktestService
from app.modules.market_data.domain.constants import ASSET_FIXED_INCOME_TYPE, SERIES
from app.modules.market_data.domain.market_data_series import MarketDataSeriesHistory

DAYS = pd.bdate_range('2020-01-02', periods=260)


def _quotes(price: float, currency_id: int = 1) -> list[dict]:
    return [
        {
            'date': day.date(),
            'close': price,
            'adjusted_close': price,
            'currency_id': currency_id,
        }
        for day in DAYS
    ]


class FakePersistedQuotes:
    """Devolve o que tem. Um ativo sem cotação volta com a lista vazia."""

    def __init__(self, quotes_by_asset: dict[int, list[dict]], tickers: dict[int, str]):
        self.quotes_by_asset = quotes_by_asset
        self.tickers = tickers
        self.calls = 0

    async def get_quotes(self, *, asset_ids, start_date=None):
        self.calls += 1
        return [
            {
                'asset_id': asset_id,
                'ticker': self.tickers.get(asset_id, f'T{asset_id}'),
                'asset_type_id': 4,
                'quotes': self.quotes_by_asset.get(asset_id, []),
            }
            for asset_id in asset_ids
        ]


class FakeOnDemandQuotes:
    def __init__(self, quotes: list[dict] | None = None):
        self.quotes = quotes or []
        self.asked = []
        self.closed = False

    async def get_quotes(self, *, ticker, asset_type_id, start_date=None):
        self.asked.append(ticker)
        return {'ticker': ticker, 'currency': 'BRL', 'quotes': self.quotes}

    async def aclose(self):
        self.closed = True


class FakeMarketData:
    def __init__(self):
        self.history_calls = []
        self.values_calls = []

    async def get_series_history_values(self, start_date=None, series_id=None, currency='BRL'):
        self.values_calls.append(series_id)
        growth = (1.0002) ** pd.Series(range(len(DAYS)), index=DAYS)
        return (100.0 * growth).astype(float)

    async def get_series_history(self, series_id, start_date=None):
        self.history_calls.append(series_id)
        # A entidade de verdade, e não um SimpleNamespace: é dela que o
        # `rows_to_df` do serviço extrai as colunas.
        return [
            MarketDataSeriesHistory(series_id=series_id, date=day.date(), close=0.04)
            for day in DAYS
        ]

    async def list_market_data_series(self):
        return [
            SimpleNamespace(id=SERIES.CDI, short_name='CDI', name='CDI'),
            SimpleNamespace(id=SERIES.IBOVESPA, short_name='IBOV', name='Ibovespa'),
        ]


class FakeUsdBrl:
    async def get_full_history(self):
        return []


def build_service(quotes_by_asset=None, tickers=None, on_demand_quotes=None):
    persisted = FakePersistedQuotes(quotes_by_asset or {}, tickers or {})
    on_demand = FakeOnDemandQuotes(on_demand_quotes)
    market_data = FakeMarketData()
    service = BacktestService(
        persisted_quotes=persisted,
        on_demand_quotes=on_demand,
        market_data=market_data,
        usd_brl=FakeUsdBrl(),
    )
    return service, persisted, on_demand, market_data


def run(**overrides):
    base = {
        'positions': [TheoreticalPositionCommand(asset_id=1, weight=100.0)],
        'currency': 'BRL',
        'initial_amount': 1000.0,
    }
    return RunBacktestCommand(**(base | overrides))


class TestPriceSources:
    async def test_a_persisted_asset_never_reaches_the_provider(self):
        service, persisted, on_demand, _ = build_service(
            quotes_by_asset={1: _quotes(100.0)}, tickers={1: 'PETR4'}
        )
        result = await service.run(run())

        assert on_demand.asked == []
        assert persisted.calls == 1
        assert result.final_value == pytest.approx(1000.0)

    async def test_an_asset_with_no_history_falls_back_to_the_provider(self):
        """O mantenedor pediu que a simulação não dependesse de ingestão prévia.

        Um ativo recém-escolhido no catálogo ainda não foi ingerido, e recusar
        a simulação por isso tornaria o laboratório inútil justamente na hora
        de experimentar.
        """
        service, _, on_demand, _ = build_service(
            quotes_by_asset={1: []},
            tickers={1: 'NOVO11'},
            on_demand_quotes=_quotes(50.0),
        )
        result = await service.run(run())

        assert on_demand.asked == ['NOVO11']
        assert result.final_value == pytest.approx(1000.0)

    async def test_a_plain_series_line_uses_the_index_level(self):
        """Um IBOVESPA na carteira e um IBOVESPA no benchmark são um número só."""
        service, _, _, market_data = build_service()
        result = await service.run(
            run(positions=[TheoreticalPositionCommand(series_id=SERIES.IBOVESPA, weight=100.0)])
        )
        assert SERIES.IBOVESPA in market_data.values_calls
        assert market_data.history_calls == []
        assert result.final_value > 1000.0

    async def test_a_synthetic_line_reads_the_series_as_a_rate(self):
        service, _, _, market_data = build_service()
        result = await service.run(
            run(
                positions=[
                    TheoreticalPositionCommand(
                        series_id=SERIES.CDI,
                        fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
                        rate=1.10,
                        weight=100.0,
                    )
                ]
            )
        )
        assert SERIES.CDI in market_data.history_calls
        assert result.final_value > 1000.0
        assert result.lines[0].label == '110% do CDI'


class TestComparison:
    async def test_varying_a_parameter_fetches_prices_once(self):
        """N variações não podem virar N idas ao banco.

        Mudar a frequência de rebalanceamento não muda preço nenhum, e é isso
        que faz o painel de variações ser barato.
        """
        service, persisted, _, _ = build_service(
            quotes_by_asset={1: _quotes(100.0)}, tickers={1: 'PETR4'}
        )
        command = CompareBacktestsCommand(
            runs=[
                run(rebalance_frequency=Frequency.NONE, label='sem rebalanceamento'),
                run(rebalance_frequency=Frequency.MONTHLY, label='mensal'),
                run(rebalance_frequency=Frequency.ANNUAL, label='anual'),
            ]
        )
        results = await service.compare(command)

        assert persisted.calls == 1
        assert [item.label for item in results] == [
            'sem rebalanceamento',
            'mensal',
            'anual',
        ]

    async def test_each_run_keeps_its_own_parameters(self):
        service, _, _, _ = build_service(
            quotes_by_asset={1: _quotes(100.0), 2: _quotes(100.0)},
            tickers={1: 'A', 2: 'B'},
        )
        command = CompareBacktestsCommand(
            runs=[
                run(contribution_amount=0.0),
                run(contribution_amount=100.0, contribution_frequency=Frequency.MONTHLY),
            ]
        )
        first, second = await service.compare(command)

        assert first.contributions == 0
        assert second.contributions > 0
        assert second.invested > first.invested

    async def test_no_run_is_refused(self):
        service, _, _, _ = build_service()
        with pytest.raises(Exception, match='Nenhuma simulação'):
            await service.compare(CompareBacktestsCommand(runs=[]))


class TestAnalysis:
    async def test_the_cdi_is_always_a_benchmark(self):
        """`calculate_returns_analysis` mede o Sharpe contra ele.

        Um Sharpe sobre outra taxa livre de risco não seria comparável com o da
        carteira real, que é o ponto de a tela ser a mesma.
        """
        service, _, _, market_data = build_service(
            quotes_by_asset={1: _quotes(100.0)}, tickers={1: 'PETR4'}
        )
        result = await service.run(run(benchmark_ids=[]))

        assert SERIES.CDI in market_data.values_calls
        assert 'CDI' in result.analysis['performance_metrics']['benchmarks_metrics']

    async def test_a_chosen_benchmark_is_added_to_the_cdi(self):
        service, _, _, _ = build_service(quotes_by_asset={1: _quotes(100.0)}, tickers={1: 'PETR4'})
        result = await service.run(run(benchmark_ids=[SERIES.IBOVESPA]))

        benchmarks = result.analysis['performance_metrics']['benchmarks_metrics']
        assert set(benchmarks) == {'CDI', 'IBOV'}

    async def test_the_analysis_carries_the_same_shape_the_real_portfolio_serves(self):
        """A tela reaproveita `RiskAnalysisCards` sem uma linha de mudança."""
        service, _, _, _ = build_service(quotes_by_asset={1: _quotes(100.0)}, tickers={1: 'PETR4'})
        result = await service.run(run())

        assert set(result.analysis) == {
            'start_date',
            'performance_metrics',
            'risk_metrics',
            'rolling_cagr',
        }
        assert set(result.analysis['risk_metrics']) >= {
            'annualized_vol',
            'sharpe_ratio',
            'drawdown',
            'semideviation',
            'skewness',
            'kurtosis',
            'var_95',
            'cvar_95',
        }
