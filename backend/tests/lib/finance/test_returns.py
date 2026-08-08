import numpy as np
import pandas as pd
import pytest

from app.lib.finance.returns import calculate_returns


def test_calculate_return_series_empty():
    price_series = pd.Series()
    returns_series = calculate_returns(price_series)
    assert returns_series.empty


def test_calculate_return_series_success():
    prices_series = pd.Series(
        data=[
            1000,
            1010,  # 1% return
            959.5,  # -5% return
        ]
    )
    return_series = calculate_returns(prices_series)
    assert return_series.values[1] == pytest.approx(0.01)
    assert return_series.values[2] == pytest.approx(-0.05)


def test_calculate_return_series_with_nan_values():
    price_series = pd.Series(
        data=[
            1000,
            np.nan,  # This should be converted to 1000 and result in 0% return
            None,  # Same as above
            1010,
        ]
    )
    return_series = calculate_returns(price_series)
    assert return_series[0] == 0
    assert return_series[1] == 0
    assert return_series[2] == 0
    assert return_series[3] == pytest.approx(0.01)
