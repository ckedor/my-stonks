import pandas as pd
from app.lib.finance.returns import calculate_acc_returns


def calculate_portfolio_daily_returns(pos_df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes daily returns for each asset in a portfolio position DataFrame.
    Expects columns: date, asset_id, quantity, price, price_usd, dividend, dividend_usd.
    """
    df = pos_df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['date', 'asset_id'])

    # BRL
    df['value'] = df['quantity'] * df['price']
    df['contribution'] = (
        df.groupby('asset_id')['quantity'].diff().fillna(0) * df['price']
    )
    df['net_value_day'] = (
        df.groupby('date')['value'].transform('sum')
        - df.groupby('date')['contribution'].transform('sum')
    )

    df['asset_return'] = df.groupby('asset_id')['price'].pct_change(fill_method=None)
    base_valor = df['value'] - df['contribution']
    df['asset_return'] += df['dividend'] / base_valor.replace(0, pd.NA)
    df['asset_return'] = pd.to_numeric(df['asset_return'], errors='coerce').fillna(0)

    # USD
    df['value_usd'] = df['quantity'] * df['price_usd']
    df['contribution_usd'] = (
        df.groupby('asset_id')['quantity'].diff().fillna(0) * df['price_usd']
    )
    df['net_value_day_usd'] = (
        df.groupby('date')['value_usd'].transform('sum')
        - df.groupby('date')['contribution_usd'].transform('sum')
    )

    df['asset_return_usd'] = df.groupby('asset_id')['price_usd'].pct_change(fill_method=None)
    base_valor_usd = df['value_usd'] - df['contribution_usd']
    df['asset_return_usd'] += df['dividend_usd'] / base_valor_usd.replace(0, pd.NA)
    df['asset_return_usd'] = pd.to_numeric(df['asset_return_usd'], errors='coerce').fillna(0)

    return df


def calculate_returns_portfolio(pos_df: pd.DataFrame) -> dict:
    """
    Computes portfolio, category, and per-asset cumulative returns.
    """
    pos_df = calculate_portfolio_daily_returns(pos_df)

    portfolio_df = calculate_portfolio_acc_return(pos_df)
    category_df = calculate_category_acc_return(pos_df)
    assets_df = calculate_asset_acc_returns(pos_df)

    category_df = portfolio_df.merge(category_df, on='date', how='left')

    return {
        "assets_returns": assets_df,
        "category_returns": category_df,
    }

def calculate_portfolio_acc_return(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes cumulative portfolio return using value-weighted daily returns.
    """
    df = df.copy()
    df['weighted_return'] = (df['value'] / df['net_value_day']) * df['asset_return']
    grouped = df.groupby('date')['weighted_return'].sum().reset_index()
    grouped['portfolio'] = calculate_acc_returns(grouped['weighted_return'])
    return grouped.drop(columns='weighted_return')


def calculate_category_acc_return(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes cumulative return per category using beginning-of-period weighting.
    """
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['asset_id', 'date'])

    df['base_value'] = (df['value'] - df['contribution']).replace(0, pd.NA)
    df['base_value_prev'] = df.groupby('asset_id')['base_value'].shift(1)
    df['category_base_prev_total'] = df.groupby(['date', 'category'])[
        'base_value_prev'
    ].transform('sum')

    df['category_weight'] = df['base_value_prev'] / df['category_base_prev_total'].replace(
        0, pd.NA
    )
    df['category_weight'] = pd.to_numeric(df['category_weight'], errors='coerce').fillna(0)

    df['category_weighted_return'] = df['category_weight'] * df['asset_return']

    daily = df.groupby(['date', 'category'])['category_weighted_return'].sum().reset_index()
    pivot = daily.pivot(
        index='date', columns='category', values='category_weighted_return'
    ).fillna(0)
    cumulative = (1 + pivot).cumprod() - 1
    return cumulative.reset_index()


def calculate_asset_acc_returns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes cumulative return per asset (ticker), pivoted by date.
    """
    df = df.copy()
    df = df.sort_values(['ticker', 'date'])
    df['asset_cum_return'] = (1 + df['asset_return']).groupby(df['ticker']).cumprod() - 1
    df.loc[df['quantity'] == 0, 'asset_cum_return'] = None
    pivot = df.pivot(index='date', columns='ticker', values='asset_cum_return')
    return pivot.reset_index()
