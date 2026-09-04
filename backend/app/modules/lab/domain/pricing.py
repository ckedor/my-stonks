"""De uma linha da carteira teórica para uma série de preço.

São duas fontes e uma saída. Um ativo cadastrado vira preço pelo fechamento
ajustado das suas cotações; uma linha sintética vira preço pela mesma
aritmética que a renda fixa cadastrada usa. O que sai é sempre uma
``pd.Series`` indexada por data, porque é só disso que o motor sabe.
"""

import pandas as pd

from app.lib.finance.fixed_income import calculate_fixed_income_price
from app.modules.market_data.domain.constants import ASSET_FIXED_INCOME_TYPE

#: O preço de partida de uma linha sintética. É arbitrário e não aparece em
#: lugar nenhum: o motor só lê variação, então 100 ou 1.000 dão a mesma
#: carteira. Cem é o que a série de um índice usa, e repetir a convenção evita
#: um número novo para explicar.
SYNTHETIC_BASE_PRICE = 100.0


def synthetic_price_series(
    *,
    index_history: pd.DataFrame,
    fixed_income_type_id: int,
    rate: float,
) -> pd.Series:
    """A série de preço de uma renda fixa sintética.

    ``index_history`` são as observações cruas da série de mercado, cujo
    ``close`` já é a taxa diária em percentual para CDI e IPCA — exatamente o
    que ``calculate_fixed_income_price`` espera. O mapa de tipo é o mesmo que a
    renda fixa cadastrada usa em ``portfolio.domain.fixed_income``, e é
    deliberado que seja: um CDB de 110% do CDI simulado aqui tem de render o
    que o CDB de 110% do CDI da carteira real rendeu.

    A diferença é o prefixado. No caminho da carteira real ele levanta
    ``NotImplementedError``, porque lá falta decidir de qual data contar; aqui
    a data é o começo da janela, então ele é trivial e fica implementado.
    """
    if index_history.empty:
        return pd.Series(dtype=float)

    frame = index_history[['date', 'close']].copy()
    frame['date'] = pd.to_datetime(frame['date'])
    frame = frame.drop_duplicates(subset='date', keep='last').sort_values('date')
    frame['close'] = pd.to_numeric(frame['close'], errors='coerce').fillna(0).astype(float)

    if fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.PERC_INDEX:
        index_multiplier, prefixed_annual_rate = float(rate), 0.0
    elif fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.INDEX_PLUS:
        index_multiplier, prefixed_annual_rate = 1.0, float(rate)
    elif fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.FIXED_RATE:
        index_multiplier, prefixed_annual_rate = 0.0, float(rate)
    else:
        raise ValueError(f'Tipo de rentabilidade desconhecido: {fixed_income_type_id}')

    prices = calculate_fixed_income_price(
        initial_price=SYNTHETIC_BASE_PRICE,
        dates=frame['date'],
        daily_index_values=frame['close'],
        index_multiplier=index_multiplier,
        prefixed_annual_rate=prefixed_annual_rate,
    )
    return pd.Series(prices.to_numpy(), index=frame['date'].to_numpy(), name='price')


def synthetic_label(
    *,
    fixed_income_type_id: int,
    rate: float,
    series_name: str | None,
) -> str:
    """Como uma linha sintética se chama quando ninguém a nomeou."""
    if fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.PERC_INDEX:
        return f'{rate * 100:g}% do {series_name}'
    if fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.INDEX_PLUS:
        return f'{series_name} + {rate * 100:g}%'
    return f'Prefixado {rate * 100:g}%'
