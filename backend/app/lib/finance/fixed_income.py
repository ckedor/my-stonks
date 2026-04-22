import numpy as np
import pandas as pd


def calculate_fixed_income_price(
    initial_price: float,
    dates: pd.Series,
    daily_index_values: pd.Series,
    index_multiplier: float = 1.0,
    prefixed_annual_rate: float = 0.0,
    dividends_per_unit: pd.Series = None,
) -> pd.Series:
    """
    Computes the theoretical price series for a fixed-income instrument.

    Parameters
    ----------
    initial_price : float
        The purchase price (unit value at inception).
    dates : pd.Series
        Date series aligned with daily_index_values (used for business day counting).
    daily_index_values : pd.Series
        Daily index variation values (e.g. CDI daily rate in %).
        Must be aligned with the date range.
    index_multiplier : float
        Multiplier applied to the index (e.g. 1.0 for index+spread, 0.9 for 90% CDI).
    prefixed_annual_rate : float
        Annual fixed rate added on top of the index (e.g. 0.02 for 2% p.a.).
        Only used in index+spread products.
    dividends_per_unit : pd.Series, optional
        Dividends (or amortizations) per unit, aligned with daily_index_values.

    Returns
    -------
    pd.Series
        Computed price series.
    """
    daily_index_factor = 1 + daily_index_values / 100 * index_multiplier
    index_factor_accumulated = daily_index_factor.cumprod()

    if prefixed_annual_rate > 0:
        daily_fee = (1 + prefixed_annual_rate) ** (1 / 252) - 1
        start_date = dates.iloc[0].date()
        business_days = dates.apply(lambda d: np.busday_count(start_date, d.date()))
        fixed_rate_factor = (1 + daily_fee) ** business_days
    else:
        fixed_rate_factor = 1.0

    price = initial_price * index_factor_accumulated * fixed_rate_factor

    if dividends_per_unit is not None:
        price = price - dividends_per_unit.cumsum()

    return price
