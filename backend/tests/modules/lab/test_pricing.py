"""A renda fixa sintética.

O que se testa aqui é a concordância: um CDB de 110% do CDI simulado no
laboratório tem de render o que o CDB de 110% do CDI cadastrado na carteira
real rendeu. Se as duas contas divergirem, a mesma pergunta responde dois
números dependendo da tela.
"""

import pandas as pd
import pytest

from app.modules.lab.domain.pricing import (
    SYNTHETIC_BASE_PRICE,
    synthetic_label,
    synthetic_price_series,
)
from app.modules.market_data.domain.constants import ASSET_FIXED_INCOME_TYPE
from app.modules.portfolio.domain.fixed_income import calculate_fixed_income_prices


def _cdi_history(days: int = 252, daily_percent: float = 0.04) -> pd.DataFrame:
    """CDI como o banco guarda: a taxa do dia, em percentual."""
    return pd.DataFrame({
        'date': pd.bdate_range('2020-01-01', periods=days),
        'close': daily_percent,
    })


class TestSyntheticPriceSeries:
    def test_a_percentage_of_the_index_compounds_the_daily_rate(self):
        history = _cdi_history(days=10)
        prices = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            rate=1.10,
        )
        expected = SYNTHETIC_BASE_PRICE * (1 + 0.0004 * 1.10) ** 10
        assert prices.iloc[-1] == pytest.approx(expected)

    def test_a_hundred_percent_of_the_index_is_the_index_itself(self):
        history = _cdi_history(days=60)
        full = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            rate=1.0,
        )
        expected = SYNTHETIC_BASE_PRICE * (1 + 0.0004) ** 60
        assert full.iloc[-1] == pytest.approx(expected)

    def test_index_plus_a_spread_adds_a_business_day_rate_on_top(self):
        history = _cdi_history(days=252)
        prices = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.INDEX_PLUS,
            rate=0.06,
        )
        plain = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            rate=1.0,
        )
        # Um ano de pregões com 6% a.a. de juro real por cima do índice.
        assert prices.iloc[-1] / plain.iloc[-1] == pytest.approx(1.06, abs=0.01)

    def test_a_fixed_rate_ignores_the_index_entirely(self):
        """No caminho da carteira real o prefixado ainda levanta.

        Aqui ele é trivial, porque a data de partida é o começo da janela, e
        fica implementado — a divergência é deliberada.
        """
        history = _cdi_history(days=252)
        prices = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.FIXED_RATE,
            rate=0.12,
        )
        assert prices.iloc[-1] / SYNTHETIC_BASE_PRICE == pytest.approx(1.12, abs=0.01)

    def test_an_empty_history_gives_an_empty_series(self):
        prices = synthetic_price_series(
            index_history=pd.DataFrame(columns=['date', 'close']),
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            rate=1.0,
        )
        assert prices.empty

    def test_an_unknown_rate_convention_is_refused(self):
        with pytest.raises(ValueError, match='Tipo de rentabilidade'):
            synthetic_price_series(
                index_history=_cdi_history(days=5),
                fixed_income_type_id=99,
                rate=1.0,
            )


class TestAgreementWithTheRealPortfolio:
    def test_the_lab_prices_a_cdb_the_way_the_portfolio_does(self):
        """A mesma aritmética, chegando ao mesmo retorno.

        A carteira real parte do preço de compra de uma operação e o
        laboratório de uma base arbitrária, então o que se compara é a
        variação, não o nível.
        """
        history = _cdi_history(days=120)
        lab = synthetic_price_series(
            index_history=history,
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            rate=1.10,
        )

        transactions = pd.DataFrame({
            'date': [history['date'].iloc[0]],
            'quantity': [1.0],
            'transaction_price_brl': [1000.0],
        })
        real = calculate_fixed_income_prices(
            fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
            fee=1.10,
            transactions_df=transactions,
            index_history_df=history,
        )

        first_day, last_day = history['date'].iloc[0], history['date'].iloc[-1]
        real_series = real.set_index('date')['close']

        # A variação entre os mesmos dois dias dos dois lados. O nível não se
        # compara: a carteira real parte do preço da operação e o laboratório
        # de uma base arbitrária.
        lab_growth = float(lab.loc[last_day] / lab.loc[first_day])
        real_growth = float(real_series.loc[last_day] / real_series.loc[first_day])
        assert lab_growth == pytest.approx(real_growth, rel=1e-9)


class TestSyntheticLabel:
    def test_a_percentage_of_the_index_reads_as_a_percentage(self):
        assert (
            synthetic_label(
                fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.PERC_INDEX,
                rate=1.10,
                series_name='CDI',
            )
            == '110% do CDI'
        )

    def test_a_spread_reads_as_the_index_plus_a_rate(self):
        assert (
            synthetic_label(
                fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.INDEX_PLUS,
                rate=0.06,
                series_name='IPCA',
            )
            == 'IPCA + 6%'
        )

    def test_a_fixed_rate_names_no_index(self):
        assert (
            synthetic_label(
                fixed_income_type_id=ASSET_FIXED_INCOME_TYPE.FIXED_RATE,
                rate=0.12,
                series_name=None,
            )
            == 'Prefixado 12%'
        )
