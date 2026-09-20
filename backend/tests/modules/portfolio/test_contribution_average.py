"""O aporte médio mensal: uma conta só, e ela conta o primeiro dia.

A tela de patrimônio e a jornada do herói mostravam R$ 3.909 e R$ 2.831 para
a mesma carteira, sob o mesmo rótulo. A diferença era exatamente o aporte do
primeiro dia — a carga que abriu a carteira —, que a conta da jornada perdia
ao subtrair a primeira ponta de uma soma acumulada que já a incluía.
"""

from app.modules.portfolio.domain.contribution_average import contribution_average


def _series(*pairs):
    """A evolução como o serviço de posição a devolve: data e aporte do dia."""
    return [{'date': date, 'portfolio': 100_000.0, 'aported': value} for date, value in pairs]


def test_the_first_day_counts():
    """O aporte que abre a carteira é aporte, e entra na média.

    Este é o caso que a conta antiga errava, e que nenhum teste pegava porque
    todos os fixtures começavam a série em zero — uma forma que a carteira real
    nunca tem: o primeiro dia da série é o dia do primeiro aporte.
    """
    average = contribution_average(
        _series(('2024-01-01', 46_000.0), ('2024-07-01', 6_000.0), ('2025-01-01', 8_000.0))
    )

    assert average == 5_000.0


def test_the_window_is_the_whole_history():
    """Doze mil em doze meses é mil por mês, e a janela é a história inteira.

    A média já saiu de uma janela curta, e com ela a data da próxima patente
    pulava a cada semestre bom ou ruim. A projeção fala de anos.
    """
    average = contribution_average(
        _series(('2024-01-01', 0.0), ('2024-07-01', 11_000.0), ('2025-01-01', 1_000.0))
    )

    assert average == 1_000.0


def test_a_withdrawal_discounts_itself():
    """Venda entra com quantidade negativa, então resgate já desconta sozinho."""
    average = contribution_average(
        _series(('2024-01-01', 12_000.0), ('2024-07-01', -6_000.0), ('2025-01-01', 6_000.0))
    )

    assert average == 1_000.0


def test_more_out_than_in_is_no_pace_at_all():
    """Ritmo negativo não é ritmo para trás: é ritmo nenhum.

    Uma projeção alimentada com aporte negativo diria que a carteira encolhe
    para sempre, o que é uma afirmação que a série não sustenta.
    """
    average = contribution_average(_series(('2024-01-01', 1_000.0), ('2025-01-01', -9_000.0)))

    assert average == 0.0


def test_dates_out_of_order_and_days_without_contribution():
    """A série chega como vier, e dia sem aporte não é zero na média.

    A média é do que entrou dividido pelos meses entre as pontas — e não a
    média das linhas, que contaria cada dia parado como um mês sem aporte.
    """
    average = contribution_average([
        {'date': '2025-01-01', 'aported': 6_000.0},
        {'date': '2024-01-01', 'aported': 6_000.0},
        {'date': '2024-06-15', 'aported': None},
        {'date': '2024-09-10'},
    ])

    assert average == 1_000.0


def test_a_single_day_has_no_months_to_divide_by():
    """Uma carteira de um dia não tem ritmo mensal, e não se inventa um."""
    assert contribution_average(_series(('2025-01-01', 10_000.0))) == 0.0
    assert contribution_average([]) == 0.0


def test_less_than_a_month_apart_is_not_a_month():
    """Duas pontas no mesmo mês não viram uma média mensal.

    Dividir por zero mês, ou arredondar para um, transformaria a primeira
    semana da carteira numa premissa de projeção.
    """
    assert contribution_average(_series(('2025-01-02', 10_000.0), ('2025-01-28', 5_000.0))) == 0.0
