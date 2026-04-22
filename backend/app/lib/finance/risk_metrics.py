import numpy as np
import pandas as pd
import scipy.stats


def drawdown(return_series: pd.Series):
    """
    Calculates wealth index, previous peaks, and drawdowns for a given time series.
    """
    
    wealth_index = (1+return_series).cumprod()
    previous_peaks = wealth_index.cummax()
    drawdowns = (wealth_index - previous_peaks)/previous_peaks
    return pd.DataFrame({
        "wealth": wealth_index,
        "peaks": previous_peaks,
        "drawdown": drawdowns
    })
    
def drawdown_stats(r: pd.Series) -> dict:
    df = drawdown(r)
    wealth, peaks, dd = df["wealth"], df["peaks"], df["drawdown"]

    max_dd = float(dd.min())
    max_dd_date = dd.idxmin()

    peak_val = float(peaks.loc[max_dd_date])
    peak_date_before = peaks.loc[:max_dd_date].idxmax()

    after = wealth.loc[max_dd_date:]
    recovered = after[after >= peak_val]
    recovery_date = recovered.index[0] if len(recovered) else None
    recovery_days = (recovery_date - peak_date_before).days if recovery_date is not None else None

    in_dd = dd < 0
    grp = (in_dd != in_dd.shift(1)).cumsum()
    max_duration_days = 0
    for _, mask in in_dd.groupby(grp):
        if not mask.iloc[0]:
            continue
        dur = (mask.index[-1] - mask.index[0]).days
        max_duration_days = max(max_duration_days, dur)

    return {
        "max_drawdown": max_dd,
        "max_drawdown_date": max_dd_date,
        "peak_date_before_max_dd": peak_date_before,
        "recovery_date": recovery_date,
        "recovery_days": recovery_days,
        "max_drawdown_duration_days": max_duration_days,
    }
    
def semideviation3(r):
    """
    Returns the semideviation aka negative semideviation of r
    r must be a Series or a DataFrame
    emideviation3 is more precise than semideviation
    """
    excess= r-r.mean()                                        # We demean the returns
    excess_negative = excess[excess<0]                        # We take only the returns below the mean
    excess_negative_square = excess_negative**2               # We square the demeaned returns below the mean
    n_negative = (excess<0).sum()                             # number of returns under the mean
    return (excess_negative_square.sum()/n_negative)**0.5 

def semideviation(r):
    """
    Returns the semidevation aka negative semideviation of r
    r must be a Series or Dataframe
    """
    
    is_negative = r < 0
    return r[is_negative].std(ddof=0)
    
def skewness(r):
    """
    Alternative to scipy.stats.skew()
    Computes the skewness of the supllied Series or DatFrame
    Returns a float or a Series
    """
    demeaned_r = r - r.mean()
    sigma_r = r.std(ddof=0)
    exp = (demeaned_r**3).mean()
    return exp/sigma_r**3

def kurtosis(r):
    """
    Alternative to scipy.stats.kurtosis()
    Computes the kurtosis of the supllied Series or DatFrame
    Returns a float or a Series
    """
    demeaned_r = r - r.mean()
    sigma_r = r.std(ddof=0)
    exp = (demeaned_r**4).mean()
    return exp/sigma_r**4

def is_normal(r, level=0.01):
    """
    Applies the Jarque-Bera test to detemine if a Series is normal or not
    Test is applied at the 1% by default
    Returns True if the hypothesis of normality is accepted, False otherwise
    """
    _, p_value = scipy.stats.jarque_bera(r)
    return p_value > level

def var_historic(r, level=5, monthly=True):
    """
    Returns the historic Value at Risk at a specified level
    i.e. returns the number such thtat "level" percent of the returns
    fall below that number, and the(100-level) percent are above
    """
    
    
    if isinstance(r, pd.DataFrame):
        return r.aggregate(var_historic, level=level)
    elif isinstance(r, pd.Series):
        if monthly:
            r = r.resample('ME').apply(lambda x: (1 + x).prod() - 1)
        return -np.percentile(r, level)
    else:
        raise TypeError("Expected r to be Series or DataFrame")
    
def var_gaussian(r, level=5, modified=False):
    """
    Returns the Parametirc Gaussian VaR of a Series or DataFrame
    If "modified" is True, then the modified VaR is returned, 
    using the Cornish-Fisher modification
    """
    # compute the Z score assuming it was Gaussian
    z = scipy.stats.norm.ppf(level/100)
    
    if modified:
        s = skewness(r)
        k = kurtosis(r)
        z = (z + (z**2 - 1)*s/6 +
             (z**3 -3*z)*(k-3)/24 -
             (2*z**3 - 5*z) * (s**2)/36
            )
    return -(r.mean() + z*r.std(ddof=0))


def cvar_historic(r, level=5):
    """
    Computes the Conditional VaR of Series or DataFrame
    """
    if isinstance(r, pd.Series):
        is_beyond = r <= -var_historic(r, level=level)
        return -r[is_beyond].mean()
    elif isinstance(r, pd.DataFrame):
         return r.aggregate(cvar_historic, level=level)
    else:
        raise TypeError("Expected r to be a Series or DataFrame")

