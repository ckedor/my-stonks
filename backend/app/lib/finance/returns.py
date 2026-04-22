import pandas as pd


def calculate_returns(prices: pd.Series) -> pd.Series:
    """Computes period returns from a price series."""
    return prices.pct_change().fillna(0)


def calculate_acc_returns(returns: pd.Series) -> pd.Series:
    """Computes cumulative returns from a returns series."""
    return (1 + returns).cumprod() - 1


def calculate_acc_returns_from_prices(prices: pd.Series) -> pd.Series:
    """Computes cumulative returns from a price series."""
    return prices / prices.iloc[0] - 1


def weighted_return(weights: pd.Series, returns: pd.Series) -> float:
    """Computes the weighted return given weights and returns."""
    return (weights * returns).sum()