import math

import pandas as pd
from app.lib.finance.performance_metrics import annualize_vol, cagr, sharpe_ratio
from app.lib.finance.returns import calculate_returns
from app.lib.finance.risk_metrics import (
    cvar_historic,
    drawdown,
    drawdown_stats,
    kurtosis,
    semideviation,
    skewness,
    var_historic,
)


def sanitize_nan(obj):
    if isinstance(obj, dict):
        return {k: sanitize_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_nan(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj

def calculate_returns_analysis(
    returns: pd.Series,
    benchmarks: dict[str, pd.Series],
) -> dict:
    
    cdi_returns = calculate_returns(benchmarks['CDI'])
    
    result = {
        "start_date": returns.index.min().strftime('%Y-%m-%d'),
        "performance_metrics": calculate_performance_metrics(returns, benchmarks),
        "risk_metrics": calculate_risk_metrics(returns, cdi_returns),
        "rolling_cagr": _calculate_rolling_cagr(returns),
    }
    return sanitize_nan(result)


def _calculate_rolling_cagr(returns: pd.Series) -> list[dict]:
    """Calculate CAGR from inception to each date."""
    acc = (1 + returns).cumprod()
    start = acc.index[0]
    results = []
    for date, cum in acc.items():
        days = (date - start).days
        if days <= 0:
            continue
        years = days / 365.25
        cagr_val = (cum ** (1 / years) - 1) * 100
        results.append({"date": str(date.date()), "value": float(cagr_val)})
    return results


def calculate_risk_metrics(returns, cdi_returns):
    annual_vol = annualize_vol(returns)
    sr = sharpe_ratio(returns, cdi_returns)

    dd_df = drawdown(returns)
    dd_stats = drawdown_stats(returns)

    dd_serialized = (
        dd_df["drawdown"]
        .reset_index()
        .rename(columns={"index": "date"})
    )
    dd_serialized["date"] = dd_serialized["date"].astype(str)
    dd_serialized = dd_serialized.to_dict(orient="records")

    return {
        "annualized_vol": annual_vol,
        "sharpe_ratio": sr,
        "drawdown": {
            "series": dd_serialized,
            "stats": dd_stats,
        },
        "semideviation": semideviation(returns),
        "skewness": skewness(returns),
        "kurtosis": kurtosis(returns),
        "var_95": var_historic(returns, level=5),
        "cvar_95": cvar_historic(returns, level=5),
    }

def calculate_performance_metrics(returns, benchmarks):
    portfolio_cagr = cagr(returns)
    
    benchmarks_metrics = {}
    for name, benchmark_history in benchmarks.items():
        benchmark_returns = calculate_returns(benchmark_history)
        cagr_benchmark = cagr(benchmark_returns)
        alpha = portfolio_cagr - cagr_benchmark
        
        corr = returns.corr(benchmark_returns)
        beta = corr * (returns.std() / benchmark_returns.std()) if benchmark_returns.std() > 0 else 0
        benchmarks_metrics[name] = {
            "cagr": cagr_benchmark * 100,
            "alpha": alpha * 100,
            "beta": beta,
            "correlation": corr
        }

    return{
        "cagr": portfolio_cagr * 100,
        "benchmarks_metrics": benchmarks_metrics
    }