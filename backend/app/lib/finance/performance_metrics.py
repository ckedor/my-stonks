import pandas as pd


def _periods_per_year(r):
    """
    Calculates the number of periods per year from the actual date span of the series.
    """
    if len(r) < 2:
        return 365.25
    days = (r.index[-1] - r.index[0]).days
    if days <= 0:
        return 365.25
    return len(r) / (days / 365.25)


def cagr(r):
    """
    Computes Compound Annual Growth Rate (CAGR) from a returns series
    using the actual calendar time span.
    """
    if len(r) < 2:
        return 0.0
    compounded_growth = (1 + r).prod()
    days = (r.index[-1] - r.index[0]).days
    if days <= 0:
        return 0.0
    years = days / 365.25
    return float(compounded_growth ** (1 / years) - 1)


def annualize_vol(r):
    """ 
    Annualizes the vol of a set of returns 
    """
    periods_per_year = _periods_per_year(r)
    return r.std(ddof=0)*(periods_per_year**0.5)

def sharpe_ratio_from_annual_rate(r, riskfree_rate):
    """
    Computes the annualized sharpe ratio of a set of returns
    """
    periods_per_year = _periods_per_year(r)
    rf_per_period = (1 + riskfree_rate)**(1/periods_per_year)-1
    excess_ret = r - rf_per_period
    ann_ex_ret = cagr(excess_ret)
    ann_vol = annualize_vol(r)
    return ann_ex_ret/ann_vol

def sharpe_ratio(r, riskfree_returns):
    """
    Computes the annualized sharpe ratio of a set of returns given a risk-free return series.
    """
    aligned = pd.concat([r, riskfree_returns], axis=1, join="inner").dropna()
    asset_r = aligned.iloc[:, 0]
    rf_r = aligned.iloc[:, 1]

    excess_ret = asset_r - rf_r
    ann_ex_ret = cagr(excess_ret)
    ann_vol = annualize_vol(asset_r)

    return ann_ex_ret / ann_vol