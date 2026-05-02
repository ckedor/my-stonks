import numpy as np
import pandas as pd
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.constants.currency import CURRENCY
from app.lib.finance.trade import average_price

DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION = 10

FIXED_INCOME_ASSET_TYPE_IDS = {
    ASSET_TYPE.CRI,
    ASSET_TYPE.CRA,
    ASSET_TYPE.DEB,
    ASSET_TYPE.CDB,
    ASSET_TYPE.LCA,
}


def is_fixed_income(asset) -> bool:
    return asset.asset_type.id in FIXED_INCOME_ASSET_TYPE_IDS


def is_treasury(asset) -> bool:
    return asset.asset_type.id == ASSET_TYPE.TREASURY


def _coerce_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors='coerce').fillna(0.0)


def consolidate_positions(
    transaction_rows,
    events,
    close_prices_df: pd.DataFrame,
    usd_brl_df: pd.DataFrame,
    dividends_df: pd.DataFrame,
) -> pd.DataFrame:
    """Build the daily position DataFrame with returns from raw inputs.

    Orchestrates the full domain pipeline: parses transactions, applies
    corporate events, converts native close prices to BRL/USD, merges
    aggregated dividends, computes cumulative quantities/totals/returns.
    """
    transactions_df = build_transactions_df(transaction_rows)
    transactions_df = apply_events(transactions_df, events)

    init_date = transactions_df['date'].min()
    prices_df = build_prices_df(close_prices_df, usd_brl_df, init_date)
    dividends_agg = build_dividends_df(dividends_df)

    position_df = build_position_df(transactions_df, prices_df, dividends_agg)

    calculate_returns(position_df)
    return position_df


def build_transactions_df(rows) -> pd.DataFrame:
    """Convert raw transaction rows into the per-date trade DataFrame
    used by the position consolidator.

    Output columns:
        date, quantity, transaction_price_brl, transaction_price_usd,
        average_price, average_price_usd
    """
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(by='date')

    # Weighted-average price per date: sum(price * qty) / sum(qty).
    # Vectorized via temporary product columns + groupby.agg (avoids the
    # slow pandas groupby().apply path).
    df['_brl_num'] = df['price'] * df['quantity']
    df['_usd_num'] = df['price_usd'] * df['quantity']
    df = (
        df.groupby('date', as_index=False)
        .agg(
            quantity=('quantity', 'sum'),
            _brl_num=('_brl_num', 'sum'),
            _usd_num=('_usd_num', 'sum'),
        )
    )
    df['transaction_price_brl'] = df['_brl_num'] / df['quantity']
    df['transaction_price_usd'] = df['_usd_num'] / df['quantity']
    df = df.drop(columns=['_brl_num', '_usd_num'])

    df['average_price'] = average_price(df, price_col='transaction_price_brl')
    df['average_price_usd'] = average_price(df, price_col='transaction_price_usd')
    return df[
        [
            'date',
            'quantity',
            'transaction_price_brl',
            'transaction_price_usd',
            'average_price',
            'average_price_usd',
        ]
    ]


def apply_events(transactions_df: pd.DataFrame, events) -> pd.DataFrame:
    """Apply corporate events (splits/inplits) to historical quantities."""
    if not events:
        return transactions_df

    for event in events:
        mask = transactions_df['date'] < pd.to_datetime(event.date)
        transactions_df.loc[mask, 'quantity'] *= event.factor

    return transactions_df


def build_prices_df(
    close_prices_df: pd.DataFrame,
    usd_brl_df: pd.DataFrame,
    init_date: pd.Timestamp,
) -> pd.DataFrame:
    """Convert close prices (in their native currency) into BRL/USD prices.

    ``close_prices_df`` must contain columns ``date``, ``close``, ``currency``
    (currency as ``CURRENCY`` id). ``usd_brl_df`` must contain ``date`` and
    ``usdbrl``.
    """
    df = close_prices_df.merge(usd_brl_df[['date', 'usdbrl']], on='date', how='left')

    df['price'] = df.apply(
        lambda row: row['close'] if row['currency'] == CURRENCY.BRL else row['close'] * row['usdbrl'],
        axis=1,
    )
    df['price_usd'] = df.apply(
        lambda row: row['close'] if row['currency'] == CURRENCY.USD else row['close'] / row['usdbrl'],
        axis=1,
    )
    df = df[['date', 'price', 'price_usd']]
    return df[df['date'] >= init_date]


def build_dividends_df(dividends_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate dividends by date with BRL and USD totals."""
    if dividends_df.empty:
        return pd.DataFrame(columns=['date', 'dividend', 'dividend_usd'])

    df = dividends_df.copy()
    df['date'] = pd.to_datetime(df['date'])
    return (
        df.groupby('date')
        .agg(dividend=('amount', 'sum'), dividend_usd=('amount_usd', 'sum'))
        .reset_index()
    )


def build_position_df(
    transactions_df: pd.DataFrame,
    prices_df: pd.DataFrame,
    dividends_agg: pd.DataFrame,
) -> pd.DataFrame:
    """Build the daily position DataFrame from trades, prices and dividends."""
    start_date = transactions_df['date'].min()
    end_date = prices_df['date'].max()
    full_dates = pd.DataFrame({'date': pd.date_range(start=start_date, end=end_date)})

    position_df = full_dates.merge(prices_df, on='date', how='left')
    position_df = position_df.merge(transactions_df, on='date', how='left')

    for col in ['price', 'price_usd', 'average_price', 'average_price_usd']:
        if col in position_df.columns:
            position_df[col] = position_df[col].ffill()

    raw_qty = position_df['quantity'].fillna(0)
    position_df['total_invested'] = (
        raw_qty * position_df['transaction_price_brl'].fillna(0)
    ).cumsum()
    position_df['total_invested_usd'] = (
        raw_qty * position_df['transaction_price_usd'].fillna(0)
    ).cumsum()

    position_df['quantity'] = raw_qty.cumsum().round(6)

    if not dividends_agg.empty:
        position_df = position_df.merge(dividends_agg, on='date', how='left')
    if 'dividend' not in position_df.columns:
        position_df['dividend'] = 0.0
    if 'dividend_usd' not in position_df.columns:
        position_df['dividend_usd'] = 0.0
    position_df['dividend'] = position_df['dividend'].fillna(0.0)
    position_df['dividend_usd'] = position_df['dividend_usd'].fillna(0.0)

    return position_df


def calculate_returns(position_df: pd.DataFrame) -> pd.DataFrame:
    """Compute daily/accumulated/12m/CAGR returns in BRL and USD."""
    # Zero out returns when investor had no exposure:
    # - days where quantity is 0
    # - day of rebuy (prev day qty was 0, price change doesn't represent earned return)
    prev_qty = position_df['quantity'].shift(1).fillna(0)
    no_exposure = (position_df['quantity'] == 0) | (prev_qty == 0)

    # BRL
    position_df['daily_return'] = _coerce_numeric(
        position_df['price'].pct_change(fill_method=None)
    )
    if 'dividend' in position_df.columns:
        base_value = position_df['quantity'] * position_df['price'].shift(1)
        position_df['daily_return'] += _coerce_numeric(
            position_df['dividend'] / base_value.replace(0, np.nan)
        )
    position_df.loc[no_exposure, 'daily_return'] = 0
    position_df['acc_return'] = (1 + position_df['daily_return']).cumprod() - 1

    position_df['twelve_months_return'] = None
    position_df['date_12m_ago'] = position_df['date'] - pd.DateOffset(years=1)
    acc_map_brl = position_df.drop_duplicates(subset='date', keep='last').set_index('date')['acc_return']
    position_df['acc_return_12m_ago'] = position_df['date_12m_ago'].map(acc_map_brl)
    position_df['twelve_months_return'] = (
        (1 + position_df['acc_return']) / (1 + position_df['acc_return_12m_ago']) - 1
    )

    # CAGR BRL
    start_date = position_df['date'].iloc[0]
    position_df['days_since_start'] = (position_df['date'] - start_date).dt.days
    position_df['cagr'] = None
    mask = position_df['days_since_start'] > 0
    years = position_df.loc[mask, 'days_since_start'] / 365.25
    position_df.loc[mask, 'cagr'] = (1 + position_df.loc[mask, 'acc_return']) ** (1 / years) - 1

    # USD
    position_df['daily_return_usd'] = _coerce_numeric(
        position_df['price_usd'].pct_change(fill_method=None)
    )
    if 'dividend_usd' in position_df.columns:
        base_value_usd = position_df['quantity'] * position_df['price_usd'].shift(1)
        position_df['daily_return_usd'] += _coerce_numeric(
            position_df['dividend_usd'] / base_value_usd.replace(0, np.nan)
        )
    position_df.loc[no_exposure, 'daily_return_usd'] = 0
    position_df['acc_return_usd'] = (1 + position_df['daily_return_usd']).cumprod() - 1

    acc_map_usd = position_df.drop_duplicates(subset='date', keep='last').set_index('date')['acc_return_usd']
    position_df['acc_return_usd_12m_ago'] = position_df['date_12m_ago'].map(acc_map_usd)
    position_df['twelve_months_return_usd'] = (
        (1 + position_df['acc_return_usd']) / (1 + position_df['acc_return_usd_12m_ago']) - 1
    )

    # CAGR USD
    position_df['cagr_usd'] = None
    years_usd = position_df.loc[mask, 'days_since_start'] / 365.25
    position_df.loc[mask, 'cagr_usd'] = (1 + position_df.loc[mask, 'acc_return_usd']) ** (1 / years_usd) - 1

    return position_df