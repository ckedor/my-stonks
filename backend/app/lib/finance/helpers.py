import pandas as pd


def calc_periods_per_year(r):
    """
    calculates the periods per year from the frequency of the return series.
    """
    if not isinstance(r.index, pd.DatetimeIndex):
        raise ValueError("The return series must have a DatetimeIndex.")
    
    freq = pd.infer_freq(r.index)
    
    if freq in ['B', 'D']:
        return 252
    elif freq == 'W': 
        return 52
    elif freq == 'M':  
        return 12
    elif freq == 'Q': 
        return 4
    elif freq == 'A': 
        return 1
    else:
        raise ValueError("Unsupported frequency. Please provide a valid time series.")