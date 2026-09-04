"""O motor da simulação. Puro: entra preço, sai carteira.

Não fala com banco, com provedor nem com serviço nenhum — o que ele recebe é
uma matriz de preços já montada e um dicionário de pesos. É o que torna cada
regra aqui testável sozinha, e é onde as decisões de produto do laboratório
ficam registradas.
"""

from collections.abc import Sequence

import pandas as pd

from app.modules.lab.domain.enums import Frequency
from app.modules.lab.domain.result import (
    BacktestLineResult,
    BacktestPoint,
    BacktestResult,
    BacktestWindow,
)

#: Abaixo disto um peso é ruído de arredondamento, não uma posição.
_WEIGHT_EPSILON = 1e-9


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """Os pesos reescalados para somar 1.

    Normalizar em vez de exigir 100 é o que faz uma carteira incompleta
    degradar honestamente: se uma linha sumiu porque o ativo foi descadastrado,
    as que ficaram mantêm a proporção entre si em vez de a simulação rodar com
    uma fatia de caixa que ninguém pediu. A tela mostra a soma e avisa quando
    não é 100 — corrigir é decisão de quem montou, não do motor.
    """
    total = sum(value for value in weights.values() if value > 0)
    if total <= _WEIGHT_EPSILON:
        raise ValueError('A carteira teórica não tem nenhum peso positivo')
    return {key: max(value, 0.0) / total for key, value in weights.items()}


def schedule_dates(index: pd.DatetimeIndex, frequency: Frequency) -> set[pd.Timestamp]:
    """Os dias do índice em que a frequência cai.

    O calendário é de mercado, não de calendário civil: a data escolhida é o
    primeiro pregão de cada período, e não o dia 1º, que na metade dos meses
    não existe na série. O primeiro dia da janela nunca entra — ele é o
    investimento inicial, e contar um aporte ali seria aportar duas vezes.
    """
    months = frequency.months
    if months is None or len(index) == 0:
        return set()

    periods = pd.Series(index.year * 12 + (index.month - 1), index=index)
    first_of_period = index[~periods.duplicated()]

    start_period = periods.iloc[0]
    offsets = (periods.loc[first_of_period] - start_period) % months
    return {date for date, offset in offsets.items() if offset == 0 and date != index[0]}


def _buy_only_distribution(
    values: dict[str, float],
    weights: dict[str, float],
    cash: float,
) -> dict[str, float]:
    """Onde pôr dinheiro novo sem vender nada.

    Enche primeiro as linhas mais abaixo do alvo, na proporção do que falta a
    cada uma; o que sobrar depois de fechar todos os déficits entra nos pesos
    alvo. Uma linha já acima do alvo não recebe nada — é a leitura que o
    glossário chama de **simulação de aporte**, e a mesma que o
    `planContribution` do frontend faz para a carteira real. As duas precisam
    concordar, senão o laboratório recomenda uma coisa e a tela de
    rebalanceamento recomenda outra.
    """
    if cash <= 0:
        return dict.fromkeys(values, 0.0)

    total_after = sum(values.values()) + cash
    deficits = {key: max(weights[key] * total_after - values[key], 0.0) for key in values}
    total_deficit = sum(deficits.values())

    if total_deficit <= _WEIGHT_EPSILON:
        return {key: cash * weights[key] for key in values}

    if total_deficit >= cash:
        share = cash / total_deficit
        return {key: deficit * share for key, deficit in deficits.items()}

    leftover = cash - total_deficit
    return {key: deficits[key] + leftover * weights[key] for key in values}


def run_backtest(  # noqa: PLR0913
    *,
    prices: pd.DataFrame,
    weights: dict[str, float],
    labels: dict[str, str] | None = None,
    initial_amount: float,
    contribution_amount: float = 0.0,
    contribution_frequency: Frequency = Frequency.NONE,
    rebalance_frequency: Frequency = Frequency.NONE,
    requested_start_date: pd.Timestamp | None = None,
) -> tuple[BacktestResult, pd.Series]:
    """Roda a carteira teórica sobre ``prices`` e devolve o resultado e a série
    de retorno diário — essa segunda para alimentar a análise de risco.

    ``prices`` traz uma coluna por linha da carteira, indexada por data. O
    recorte da janela é responsabilidade de quem monta a matriz: aqui ela já
    chega com as datas que valem.
    """
    if prices.empty:
        raise ValueError('Não há preço para nenhuma linha da carteira teórica')

    targets = normalize_weights(weights)
    labels = labels or {}
    columns = [key for key in prices.columns if key in targets]
    prices = prices[columns].astype(float)

    contribution_days = schedule_dates(prices.index, contribution_frequency)
    rebalance_days = schedule_dates(prices.index, rebalance_frequency)
    contributes = contribution_frequency.months is not None and contribution_amount > 0

    first_prices = prices.iloc[0]
    units = {key: initial_amount * targets[key] / first_prices[key] for key in columns}

    invested = initial_amount
    contributions = 0
    rebalances = 0
    daily_returns: list[float] = []
    points: list[BacktestPoint] = [
        BacktestPoint(
            date=prices.index[0].date(),
            value=initial_amount,
            invested=invested,
            acc_return=0.0,
        )
    ]
    previous_value = initial_amount
    accumulated = 1.0

    for day in prices.index[1:]:
        day_prices = prices.loc[day]
        values = {key: units[key] * day_prices[key] for key in columns}
        total = sum(values.values())

        # O retorno é medido antes de qualquer fluxo de caixa: um aporte
        # aumenta o patrimônio sem ser rentabilidade, e somá-lo aqui faria a
        # carteira parecer render o que ela só recebeu. É a mesma disciplina do
        # `net_value_day` na consolidação da carteira real.
        daily_returns.append(total / previous_value - 1 if previous_value > 0 else 0.0)

        if contributes and day in contribution_days:
            added = _buy_only_distribution(values, targets, contribution_amount)
            values = {key: values[key] + added[key] for key in columns}
            total += contribution_amount
            invested += contribution_amount
            contributions += 1

        # O rebalanceamento vem depois do aporte no dia que é as duas coisas:
        # aportar primeiro é o que evita vender numa data em que o dinheiro
        # novo já teria corrigido a distorção sozinho.
        if day in rebalance_days:
            values = {key: targets[key] * total for key in columns}
            rebalances += 1

        units = {
            key: (values[key] / day_prices[key] if day_prices[key] > 0 else units[key])
            for key in columns
        }
        previous_value = total

        accumulated *= 1 + daily_returns[-1]
        points.append(
            BacktestPoint(
                date=day.date(),
                value=float(total),
                invested=float(invested),
                acc_return=float(accumulated - 1),
            )
        )

    returns = pd.Series(daily_returns, index=prices.index[1:], name='return')

    last_prices = prices.iloc[-1]
    final_values = {key: units[key] * last_prices[key] for key in columns}
    final_total = sum(final_values.values())
    lines = [
        BacktestLineResult(
            key=key,
            label=labels.get(key, key),
            target_weight=targets[key] * 100,
            final_weight=(final_values[key] / final_total * 100) if final_total > 0 else 0.0,
            final_value=float(final_values[key]),
        )
        for key in columns
    ]

    result = BacktestResult(
        window=BacktestWindow(
            start_date=prices.index[0].date(),
            end_date=prices.index[-1].date(),
            requested_start_date=(
                requested_start_date.date() if requested_start_date is not None else None
            ),
        ),
        series=points,
        lines=lines,
        final_value=float(final_total),
        invested=float(invested),
        profit=float(final_total - invested),
        contributions=contributions,
        rebalances=rebalances,
    )
    return result, returns


def align_prices(
    series_by_key: dict[str, pd.Series],
    *,
    start_date: pd.Timestamp | None = None,
    end_date: pd.Timestamp | None = None,
) -> tuple[pd.DataFrame, str | None]:
    """A matriz de preços comum a todas as linhas, e a linha que a encurtou.

    Cada linha chega com o calendário da sua fonte: uma ação brasileira não
    negocia no feriado americano, uma cripto negocia no domingo e o CDI só
    existe em dia útil. Unir por data e preencher para a frente com o último
    preço conhecido resolve o descompasso sem inventar preço para antes do
    primeiro — daí o recorte começar onde **toda** linha já tem preço, que é o
    que faz a simulação ser da carteira que se pediu e não de uma parte dela.
    """
    if not series_by_key:
        raise ValueError('A carteira teórica não tem nenhuma linha')

    frame = pd.DataFrame(series_by_key).sort_index()

    first_dates = {key: frame[key].first_valid_index() for key in frame.columns}
    if any(value is None for value in first_dates.values()):
        missing = [key for key, value in first_dates.items() if value is None]
        raise ValueError(f'Sem preço para: {", ".join(missing)}')

    # O preenchimento para a frente resolve o descompasso de calendário, mas
    # não pode passar do último preço de uma linha: uma ação que parou de ser
    # negociada em 2010 continuaria "valendo" o preço de 2010 para sempre, e a
    # carteira leria um ativo morto como uma linha estável. A janela termina
    # onde a primeira linha para, do mesmo jeito que começa onde a última
    # começa.
    last_dates = {key: frame[key].last_valid_index() for key in frame.columns}
    common_end = min(last_dates.values())

    frame = frame.ffill()

    limiting_key = max(first_dates, key=lambda key: first_dates[key])
    common_start = first_dates[limiting_key]
    limited_by: str | None = limiting_key

    if start_date is not None and start_date > common_start:
        common_start = start_date
        limited_by = None

    if end_date is not None:
        common_end = min(common_end, end_date)

    if common_start > common_end:
        raise ValueError('A janela pedida não tem dias suficientes para simular')

    frame = frame.loc[common_start:common_end].dropna()
    if len(frame) < 2:
        raise ValueError('A janela pedida não tem dias suficientes para simular')
    return frame, limited_by


def resolve_window_start(
    *,
    years: int | None,
    start_date: pd.Timestamp | None,
    today: pd.Timestamp,
) -> pd.Timestamp | None:
    """A data de início pedida, vinda de uma data ou de um número de anos.

    Os presets de janela da tela — 1, 5 e 10 anos — são contados para trás a
    partir de hoje, e não de uma data fixa: "10 anos" quer dizer a última
    década, e ela anda com o calendário.
    """
    if start_date is not None:
        return start_date
    if years is None:
        return None
    return today - pd.DateOffset(years=years)


def series_from_quotes(quotes: Sequence[dict], price_of) -> pd.Series:
    """Uma série de preço a partir de cotações serializadas."""
    rows = [(quote['date'], price_of(quote)) for quote in quotes]
    rows = [(day, price) for day, price in rows if price is not None]
    if not rows:
        return pd.Series(dtype=float)
    frame = pd.DataFrame(rows, columns=['date', 'price'])
    frame['date'] = pd.to_datetime(frame['date'])
    frame = frame.drop_duplicates(subset='date', keep='last').sort_values('date')
    return frame.set_index('date')['price'].astype(float)
