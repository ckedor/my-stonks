from datetime import datetime

import numpy as np
import pandas as pd
from app.infra.db.models.constants.asset_fixed_income_type import (
    ASSET_FIXED_INCOME_TYPE,
)
from app.lib.finance.fixed_income import calculate_fixed_income_price


def calculate_fixed_income_prices(
    fixed_income_type_id: int,
    fee: float,
    transactions_df: pd.DataFrame,
    index_history_df: pd.DataFrame,
    dividends_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """
    Computes the price history for a fixed-income asset.

    Parameters
    ----------
    fixed_income_type_id : int
        The type of fixed income (INDEX_PLUS, PERC_INDEX, FIXED_RATE).
    fee : float
        The fee/rate associated with the product.
    transactions_df : pd.DataFrame
        Must have columns: date, quantity, transaction_price_brl.
    index_history_df : pd.DataFrame
        Must have columns: date, close.
    dividends_df : pd.DataFrame, optional
        Must have columns: date, amount (if provided).

    Returns
    -------
    pd.DataFrame
        Columns: date, close.
    """
    pos_df = _build_position_df(transactions_df, index_history_df)

    if dividends_df is not None and not dividends_df.empty:
        pos_df = pos_df.merge(dividends_df[['date', 'amount']], on='date', how='left')
        pos_df['dividend'] = pos_df['amount'].fillna(0)
    else:
        pos_df['dividend'] = 0.0

    if fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.FIXED_RATE:
        raise NotImplementedError('Fixed rate calculation not implemented')

    elif fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.INDEX_PLUS:
        index_multiplier = 1.0
        prefixed_annual_rate = float(fee)

    elif fixed_income_type_id == ASSET_FIXED_INCOME_TYPE.PERC_INDEX:
        index_multiplier = float(fee)
        prefixed_annual_rate = 0.0

    else:
        raise ValueError(f'Unknown fixed income type: {fixed_income_type_id}')

    initial_price = pos_df.iloc[0]['transaction_price_brl']

    dividends_per_unit = np.where(
        (pos_df['dividend'] > 0) & (pos_df['quantity'] > 0),
        pos_df['dividend'] / pos_df['quantity'],
        0.0,
    )

    pos_df['close'] = calculate_fixed_income_price(
        initial_price=initial_price,
        dates=pos_df['date'],
        daily_index_values=pos_df['close'].fillna(0).astype(float),
        index_multiplier=index_multiplier,
        prefixed_annual_rate=prefixed_annual_rate,
        dividends_per_unit=pd.Series(dividends_per_unit, index=pos_df.index),
    )

    return pos_df[['date', 'close']]


def _build_position_df(
    transactions_df: pd.DataFrame,
    index_history_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Merges transaction data with index history into a daily position DataFrame.
    """
    transactions_df = transactions_df.copy()
    transactions_df['date'] = pd.to_datetime(transactions_df['date'])

    init_date = transactions_df['date'].min()
    final_date = datetime.today()

    all_dates = pd.date_range(start=init_date, end=final_date, freq='D')
    pos_df = pd.DataFrame(all_dates, columns=['date'])

    pos_df = pos_df.merge(
        transactions_df[['date', 'quantity', 'transaction_price_brl']],
        on='date',
        how='left',
    )
    pos_df['quantity'] = pos_df['quantity'].fillna(0).cumsum()
    pos_df = pos_df[pos_df['quantity'] > 0]

    pos_df = pos_df.sort_values('date').merge(
        index_history_df[['date', 'close']].sort_values('date'),
        on='date',
        how='left',
    )
    pos_df['close'] = pos_df['close'].fillna(0)

    return pos_df

    return pos_df
