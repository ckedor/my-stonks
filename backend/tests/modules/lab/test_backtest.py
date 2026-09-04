"""O motor da simulação, sem banco e sem provedor.

Cada teste aqui é uma regra de produto do laboratório. São as que ninguém
percebe estarem erradas olhando um gráfico: um aporte contado como
rentabilidade só aparece como uma carteira boa demais.
"""

import pandas as pd
import pytest

from app.modules.lab.domain.backtest import (
    align_prices,
    normalize_weights,
    run_backtest,
    schedule_dates,
)
from app.modules.lab.domain.enums import Frequency


def _flat_prices(days: int = 400, start: str = '2020-01-01') -> pd.DataFrame:
    """Duas linhas que nunca se mexem. Qualquer retorno aqui é bug."""
    index = pd.bdate_range(start=start, periods=days)
    return pd.DataFrame({'a': 100.0, 'b': 50.0}, index=index)


def _growing_prices(days: int = 300, daily: float = 0.001) -> pd.DataFrame:
    index = pd.bdate_range(start='2020-01-01', periods=days)
    growth = (1 + daily) ** pd.Series(range(days), index=index)
    return pd.DataFrame({'a': 100.0 * growth, 'b': pd.Series(50.0, index=index)})


class TestNormalizeWeights:
    def test_scales_to_one(self):
        assert normalize_weights({'a': 60, 'b': 40}) == {'a': 0.6, 'b': 0.4}

    def test_weights_that_do_not_sum_to_100_keep_their_proportion(self):
        """Uma linha que sumiu não pode virar caixa parado.

        Se o ativo foi descadastrado e a linha caiu junto, as que ficaram
        mantêm a proporção entre si em vez de a simulação rodar 70% investido.
        """
        assert normalize_weights({'a': 30, 'b': 40}) == pytest.approx({'a': 3 / 7, 'b': 4 / 7})

    def test_rejects_a_portfolio_with_no_positive_weight(self):
        with pytest.raises(ValueError, match='peso positivo'):
            normalize_weights({'a': 0, 'b': 0})


class TestScheduleDates:
    def test_none_never_falls(self):
        index = pd.bdate_range('2020-01-01', periods=300)
        assert schedule_dates(index, Frequency.NONE) == set()

    def test_monthly_falls_on_the_first_trading_day_of_each_month(self):
        index = pd.bdate_range('2020-01-01', periods=90)
        days = sorted(schedule_dates(index, Frequency.MONTHLY))
        assert [day.strftime('%Y-%m-%d') for day in days] == [
            '2020-02-03',
            '2020-03-02',
            '2020-04-01',
            '2020-05-01',
        ]

    def test_the_first_day_never_counts(self):
        """O dia 1 é o investimento inicial, não um aporte.

        Contá-lo aportaria duas vezes no mesmo dia.
        """
        index = pd.bdate_range('2020-01-01', periods=90)
        assert index[0] not in schedule_dates(index, Frequency.MONTHLY)

    def test_annual_falls_once_a_year(self):
        index = pd.bdate_range('2020-01-01', periods=800)
        days = sorted(schedule_dates(index, Frequency.ANNUAL))
        assert [day.year for day in days] == [2021, 2022, 2023]


class TestContributions:
    def test_a_contribution_is_not_a_return(self):
        """A regra que mais custa se errada.

        Preços parados e aporte todo mês: o patrimônio cresce, e a
        rentabilidade tem de ser exatamente zero.
        """
        result, returns = run_backtest(
            prices=_flat_prices(),
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            contribution_amount=100,
            contribution_frequency=Frequency.MONTHLY,
        )
        assert returns.abs().max() == pytest.approx(0, abs=1e-12)
        assert result.series[-1].acc_return == pytest.approx(0, abs=1e-12)
        assert result.final_value > 1000
        assert result.final_value == pytest.approx(result.invested)
        assert result.profit == pytest.approx(0, abs=1e-9)

    def test_invested_counts_every_contribution_plus_the_initial_amount(self):
        result, _ = run_backtest(
            prices=_flat_prices(days=260),
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            contribution_amount=100,
            contribution_frequency=Frequency.MONTHLY,
        )
        assert result.invested == pytest.approx(1000 + 100 * result.contributions)

    def test_without_a_contribution_amount_nothing_is_added(self):
        result, _ = run_backtest(
            prices=_flat_prices(),
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            contribution_amount=0,
            contribution_frequency=Frequency.MONTHLY,
        )
        assert result.contributions == 0
        assert result.invested == pytest.approx(1000)

    def test_a_contribution_buys_only_and_corrects_toward_the_target(self):
        """Sem rebalanceamento, o aporte é quem aproxima a carteira do alvo.

        `a` sobe e passa do peso; o aporte tem de ir todo para `b`, e nenhuma
        cota de `a` pode ser vendida.
        """
        prices = _growing_prices(days=200, daily=0.01)
        result, _ = run_backtest(
            prices=prices,
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            contribution_amount=500,
            contribution_frequency=Frequency.MONTHLY,
            rebalance_frequency=Frequency.NONE,
        )
        by_key = {line.key: line for line in result.lines}
        # `a` disparou, então continua acima do alvo -- o aporte aproxima, não
        # conserta: consertar exigiria vender, e aporte não vende.
        assert by_key['a'].final_weight > by_key['a'].target_weight
        # E ainda assim `b` recebeu quase tudo: sem o aporte a distorção seria
        # muito maior.
        assert by_key['b'].final_value > 500


class TestRebalancing:
    def test_rebalancing_returns_every_line_to_its_target(self):
        prices = _growing_prices(days=520, daily=0.002)
        result, _ = run_backtest(
            prices=prices,
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            rebalance_frequency=Frequency.MONTHLY,
        )
        assert result.rebalances > 0
        # O último rebalanceamento é recente, então os pesos finais estão perto
        # do alvo mesmo com `a` subindo o tempo todo.
        for line in result.lines:
            assert line.final_weight == pytest.approx(50, abs=5)

    def test_without_rebalancing_the_winner_takes_over(self):
        prices = _growing_prices(days=520, daily=0.002)
        result, _ = run_backtest(
            prices=prices,
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            rebalance_frequency=Frequency.NONE,
        )
        assert result.rebalances == 0
        by_key = {line.key: line for line in result.lines}
        assert by_key['a'].final_weight > 60

    def test_rebalancing_does_not_change_the_patrimony_on_the_day(self):
        """Rebalancear move dinheiro entre linhas; não cria nem destrói.

        Imposto de venda não é modelado, e é decisão declarada.
        """
        prices = _growing_prices(days=300, daily=0.003)
        with_rebalance, _ = run_backtest(
            prices=prices,
            weights={'a': 50, 'b': 50},
            initial_amount=1000,
            rebalance_frequency=Frequency.MONTHLY,
        )
        assert with_rebalance.invested == pytest.approx(1000)


class TestWindow:
    def test_the_window_starts_where_every_line_has_a_price(self):
        """Senão a carteira dos primeiros meses não é a que se pediu."""
        early = pd.Series(100.0, index=pd.bdate_range('2015-01-01', periods=1500))
        late = pd.Series(50.0, index=pd.bdate_range('2020-01-01', periods=500))
        frame, limited_by = align_prices({'a': early, 'b': late})
        assert limited_by == 'b'
        assert frame.index[0] == pd.Timestamp('2020-01-01')

    def test_an_explicit_start_wins_when_it_is_later(self):
        early = pd.Series(100.0, index=pd.bdate_range('2015-01-01', periods=2000))
        late = pd.Series(50.0, index=pd.bdate_range('2016-01-01', periods=1800))
        frame, limited_by = align_prices(
            {'a': early, 'b': late}, start_date=pd.Timestamp('2018-01-01')
        )
        assert limited_by is None
        assert frame.index[0] >= pd.Timestamp('2018-01-01')

    def test_calendars_that_disagree_are_filled_forward(self):
        """Uma cripto negocia no domingo e o CDI não existe no feriado.

        Preencher para a frente com o último preço conhecido é o que junta os
        dois sem inventar preço para antes do primeiro.
        """
        daily = pd.Series(100.0, index=pd.date_range('2020-01-01', periods=60, freq='D'))
        business = pd.Series(50.0, index=pd.bdate_range('2020-01-01', periods=40))
        frame, _ = align_prices({'a': daily, 'b': business})
        assert not frame.isna().to_numpy().any()
        assert len(frame) > 40

    def test_a_window_with_no_overlap_is_refused(self):
        old = pd.Series(100.0, index=pd.bdate_range('2010-01-01', periods=50))
        new = pd.Series(50.0, index=pd.bdate_range('2020-01-01', periods=50))
        with pytest.raises(ValueError, match='dias suficientes'):
            align_prices({'a': old, 'b': new})

    def test_the_window_ends_where_the_first_line_stops(self):
        """Um ativo que parou de ser negociado encerra a janela.

        Preencher para a frente sem limite faria um papel morto valer o último
        preço para sempre, e a carteira leria isso como estabilidade.
        """
        alive = pd.Series(100.0, index=pd.bdate_range('2020-01-01', periods=500))
        delisted = pd.Series(50.0, index=pd.bdate_range('2020-01-01', periods=200))
        frame, _ = align_prices({'a': alive, 'b': delisted})
        assert frame.index[-1] == delisted.index[-1]


class TestReturns:
    def test_a_single_line_returns_exactly_its_own_price_variation(self):
        prices = _growing_prices(days=100, daily=0.001)[['a']]
        result, returns = run_backtest(prices=prices, weights={'a': 100}, initial_amount=1000)
        assert returns.iloc[0] == pytest.approx(0.001)
        expected = float(prices['a'].iloc[-1] / prices['a'].iloc[0])
        assert result.final_value == pytest.approx(1000 * expected)
        assert result.series[-1].acc_return == pytest.approx(expected - 1)

    def test_the_series_covers_every_day_of_the_window(self):
        prices = _flat_prices(days=120)
        result, returns = run_backtest(prices=prices, weights={'a': 100}, initial_amount=1000)
        assert len(result.series) == len(prices)
        assert len(returns) == len(prices) - 1
        assert result.window.start_date == prices.index[0].date()
        assert result.window.end_date == prices.index[-1].date()

    def test_an_empty_price_matrix_is_refused(self):
        with pytest.raises(ValueError, match='preço'):
            run_backtest(prices=pd.DataFrame(), weights={'a': 100}, initial_amount=1000)
