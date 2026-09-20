"""How an asset did, measured by the application and never by the model.

This is the half of the correctness story that schema enforcement cannot cover.
A model asked to describe a return will produce a plausible number whether or
not it was given one, and a plausible number on a portfolio screen is worse
than no number. So every figure a description states is computed here, from
persisted quotes, and handed to the prompt already written.

The measurements are the ones a plain description needs and no more: what it
last traded at, what it did over a year, what it compounded at, how much it
moved, and how far it fell. Sharpe against a benchmark is an evaluation, and
this feature does not evaluate.
"""

import math
from dataclasses import asdict, dataclass

import pandas as pd

from app.lib.finance.performance_metrics import annualize_vol, cagr
from app.lib.finance.returns import calculate_returns
from app.lib.finance.risk_metrics import drawdown_stats

TRADING_DAYS_IN_A_YEAR = 252
MIN_QUOTES_FOR_METRICS = 30


@dataclass(frozen=True)
class PerformanceSummary:
    first_date: str | None = None
    last_date: str | None = None
    last_close: float | None = None
    return_12m_pct: float | None = None
    cagr_pct: float | None = None
    volatility_pct: float | None = None
    max_drawdown_pct: float | None = None

    def as_prompt_dict(self) -> dict:
        """The figures as the template sees them, already rounded.

        Rounding here rather than in the prompt keeps the same number in the
        artifact, in the trace and on the screen.
        """
        rounded = {
            key: (round(value, 2) if isinstance(value, float) else value)
            for key, value in asdict(self).items()
        }
        return rounded


def summarize_performance(quotes: list[dict]) -> PerformanceSummary:
    """Describe a quote series, or say nothing when there is not enough of one.

    An asset with a handful of quotes gets an empty summary rather than a
    volatility computed over four days. Absent reads as "not measured", which
    the prompt is told to say plainly; a number computed from nothing would
    read as a measurement.
    """
    closes = _closing_prices(quotes)
    if closes.empty:
        return PerformanceSummary()

    first_date = str(closes.index[0].date())
    last_date = str(closes.index[-1].date())
    last_close = float(closes.iloc[-1])

    if len(closes) < MIN_QUOTES_FOR_METRICS:
        return PerformanceSummary(first_date=first_date, last_date=last_date, last_close=last_close)

    returns = calculate_returns(closes).dropna()
    if returns.empty:
        return PerformanceSummary(first_date=first_date, last_date=last_date, last_close=last_close)

    return PerformanceSummary(
        first_date=first_date,
        last_date=last_date,
        last_close=last_close,
        return_12m_pct=_return_12m_pct(closes),
        cagr_pct=_percent(cagr(returns)),
        volatility_pct=_percent(annualize_vol(returns)),
        max_drawdown_pct=_max_drawdown_pct(returns),
    )


def _closing_prices(quotes: list[dict]) -> pd.Series:
    points = {
        quote['date']: float(quote['close'])
        for quote in quotes
        if quote.get('close') is not None and quote.get('date')
    }
    if not points:
        return pd.Series(dtype='float64')
    series = pd.Series(points)
    series.index = pd.to_datetime(series.index)
    return series.sort_index()


def _return_12m_pct(closes: pd.Series) -> float | None:
    """Measured over the last 252 trading days, not the last calendar year.

    The series only holds days the market was open, so counting back a year of
    rows is what actually lands twelve months ago.
    """
    if len(closes) <= TRADING_DAYS_IN_A_YEAR:
        return None
    start, end = float(closes.iloc[-TRADING_DAYS_IN_A_YEAR - 1]), float(closes.iloc[-1])
    if start <= 0:
        return None
    return _percent(end / start - 1)


def _max_drawdown_pct(returns: pd.Series) -> float | None:
    stats = drawdown_stats(returns)
    value = stats.get('max_drawdown') if isinstance(stats, dict) else None
    return _percent(value)


def _percent(value) -> float | None:
    if value is None:
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return number * 100
