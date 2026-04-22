import pandas as pd


def profits_by_month_df(trades_df: pd.DataFrame) -> pd.DataFrame:    
    df = profit_by_trade_df(trades_df)
    df['month'] = pd.to_datetime(df['date']).dt.to_period('M')
    df['gross_sales'] = gross_sales(df)

    monthly_profits = df.groupby('month').agg({
        'realized_profit': 'sum',
        'gross_sales': 'sum'
    }).reset_index()

    return monthly_profits

def profit_by_trade_df(trades_df: pd.DataFrame) -> pd.DataFrame:
    trades_df = trades_df.sort_values(by='date').reset_index(drop=True)
    df = trades_df.copy()
    
    df['average_price'] = average_price(df)
    df['realized_profit'] = profit(df)
    return df

def average_price(
    trades_df: pd.DataFrame,
    price_col: str = 'price',
    quantity_col: str = 'quantity'
) -> pd.Series:
    trades_df = trades_df.sort_values(by='date').reset_index(drop=True)
    average_prices = []
    quantity_held = 0.0
    total_cost = 0.0
    last_avg_price = 0.0

    for _, row in trades_df.iterrows():
        quantity = float(row[quantity_col])
        price = float(row[price_col])

        if quantity > 0:
            total_cost += quantity * price
            quantity_held += quantity
            last_avg_price = total_cost / quantity_held
        else:
            if quantity_held > 0:
                total_cost -= last_avg_price * abs(quantity)
                quantity_held += quantity

        average_prices.append(last_avg_price)

    return pd.Series(average_prices, index=trades_df.index)

def profit(trades_df: pd.DataFrame) -> pd.DataFrame:
    return trades_df.apply(
        lambda row: abs(row['quantity']) * (row['price'] - row['average_price']) if row['quantity'] < 0 else 0.0,
        axis=1
    )
    
def gross_sales(trades_df: pd.DataFrame) -> pd.DataFrame:
    return trades_df.apply(
        lambda row: -row['total_amount'] if row['quantity'] < 0 else 0.0,
        axis=1
    )
