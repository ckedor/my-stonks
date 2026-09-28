"""Market readings: where a series stands against its own history.

Deterministic arithmetic over stored history -- no forecast and no model.
Everything is measured on weekly closes (the last observation of each week
ending on Friday): the exchange rate, crypto and the stock indexes do not share
a calendar, and a weekly frame is the one they can all be compared on.

What a reading can and cannot say: it places a price against the price's own
past. It is not valuation -- that needs earnings, which these series do not
carry. "Far above its trend and in the top decile of that distance" is a
statement about the price path, not about whether the thing is expensive.
"""

from dataclasses import dataclass, field
from datetime import date

import pandas as pd

#: 40 weekly closes, the weekly form of the 200-session moving average.
MOVING_AVERAGE_WEEKS = 40
WEEKS_PER_YEAR = 52
WEEKLY_PERIOD = 'W-FRI'
#: Below a year, annualizing extrapolates noise instead of measuring it.
MIN_DAYS_TO_ANNUALIZE = 365
#: The chart keeps every week of the recent past and one point a month before
#: it: a quarter of a century weekly is most of a megabyte of JSON for a line
#: nobody reads at that resolution.
WEEKLY_CHART_YEARS = 5


@dataclass(frozen=True)
class ReadingPoint:
    date: date
    value: float
    moving_average: float | None = None


@dataclass(frozen=True, kw_only=True)
class LevelReading:
    """A price or index level, and how it has moved.

    Returns are fractions (0.12 is 12%). A percentile is the share of the
    series' own weekly history at or below the current observation, from 0 to
    1; ``None`` when there is not enough history to rank against.
    """

    key: str
    as_of: date
    value: float
    series_id: int | None = None
    #: The asset the reading is of, when it is an asset's quotes (bitcoin).
    asset_id: int | None = None
    since: date
    since_start_annualized_return: float | None
    year_to_date_return: float | None
    one_year_return: float | None
    five_year_annualized_return: float | None
    ten_year_annualized_return: float | None
    ten_year_return_percentile: float | None
    moving_average: float | None
    distance_to_moving_average: float | None
    distance_percentile: float | None
    drawdown: float
    history: list[ReadingPoint] = field(default_factory=list)


@dataclass(frozen=True, kw_only=True)
class RateReading:
    """A rate (a fraction per year) and where it sits in its own history."""

    key: str
    as_of: date
    value: float
    series_id: int | None = None
    since: date
    one_year_ago: float | None
    percentile: float | None
    history: list[ReadingPoint] = field(default_factory=list)


def weekly_closes(values: pd.Series) -> pd.Series:
    """Last observation of each week, kept at the date it was observed.

    Not labelled by the week's Friday: a Sunday close of bitcoin would come out
    dated the Friday after, a day that has not happened yet. ``values`` has a
    DatetimeIndex. Weeks with no observation are dropped, not filled.
    """
    clean = values.dropna().sort_index()
    clean = clean[clean > 0]
    return _last_per_period(clean, WEEKLY_PERIOD)


def weekly_last(values: pd.Series) -> pd.Series:
    """Like `weekly_closes`, for a series that may be zero or negative: a rate."""
    return _last_per_period(values.dropna().sort_index(), WEEKLY_PERIOD)


def chart_points(values: pd.Series) -> pd.Series:
    """Weekly for the last `WEEKLY_CHART_YEARS`, monthly before that."""
    if values.empty:
        return values
    cutoff = values.index[-1] - pd.DateOffset(years=WEEKLY_CHART_YEARS)
    older = values[values.index < cutoff]
    return pd.concat([_last_per_period(older, 'M'), values[values.index >= cutoff]])


def percentile_of_last(values: pd.Series) -> float | None:
    """Share of observations at or below the last one, the last included."""
    clean = values.dropna()
    if len(clean) < WEEKS_PER_YEAR:
        return None
    return float((clean <= clean.iloc[-1]).mean())


def level_reading(
    key: str,
    weekly: pd.Series,
    *,
    series_id: int | None = None,
    asset_id: int | None = None,
) -> LevelReading:
    """Read a level series already reduced to weekly closes."""
    if weekly.empty:
        raise ValueError(f'No history to read for {key}')
    last_date = weekly.index[-1]
    last = float(weekly.iloc[-1])

    moving_average = weekly.rolling(MOVING_AVERAGE_WEEKS).mean()
    distance = weekly / moving_average - 1
    current_distance = distance.iloc[-1]

    annualized_10y = _annualized_rolling(weekly, years=10)

    return LevelReading(
        key=key,
        series_id=series_id,
        asset_id=asset_id,
        as_of=last_date.date(),
        since=weekly.index[0].date(),
        value=last,
        since_start_annualized_return=_annualized_since_start(weekly),
        year_to_date_return=_return_since(weekly, pd.Timestamp(last_date.year - 1, 12, 31)),
        one_year_return=_return_since(weekly, last_date - pd.DateOffset(years=1)),
        five_year_annualized_return=_annualized_since(weekly, years=5),
        ten_year_annualized_return=_annualized_since(weekly, years=10),
        ten_year_return_percentile=percentile_of_last(annualized_10y),
        moving_average=_float_or_none(moving_average.iloc[-1]),
        distance_to_moving_average=_float_or_none(current_distance),
        distance_percentile=percentile_of_last(distance),
        drawdown=float(last / weekly.cummax().iloc[-1] - 1),
        history=[
            ReadingPoint(
                date=index.date(),
                value=_chart_value(value),
                moving_average=_chart_value(moving_average.loc[index]),
            )
            for index, value in chart_points(weekly).items()
        ],
    )


def rate_reading(key: str, weekly: pd.Series, *, series_id: int | None = None) -> RateReading:
    """Read a rate series already reduced to weekly observations."""
    weekly = weekly.dropna()
    if weekly.empty:
        raise ValueError(f'No history to read for {key}')
    last_date = weekly.index[-1]
    year_ago = weekly[weekly.index <= last_date - pd.DateOffset(years=1)]
    return RateReading(
        key=key,
        series_id=series_id,
        as_of=last_date.date(),
        since=weekly.index[0].date(),
        value=float(weekly.iloc[-1]),
        one_year_ago=float(year_ago.iloc[-1]) if not year_ago.empty else None,
        percentile=percentile_of_last(weekly),
        history=[
            ReadingPoint(date=index.date(), value=_chart_value(value))
            for index, value in chart_points(weekly).items()
        ],
    )


def ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """One level over another on the weeks both have, rebased to 100.

    Rising means the numerator outperformed. Rebased because the raw quotient
    of two index levels is a number with no meaning of its own.
    """
    joined = pd.concat([numerator, denominator], axis=1, join='inner').dropna()
    if joined.empty:
        return pd.Series(dtype=float)
    quotient = joined.iloc[:, 0] / joined.iloc[:, 1]
    return quotient / quotient.iloc[0] * 100


def restated(values: pd.Series, rate: pd.Series) -> pd.Series:
    """A level in another currency: each value times the last rate known by then.

    Observations before the first rate are dropped rather than left unconverted.
    """
    clean_rate = rate.dropna().sort_index()
    if values.empty or clean_rate.empty:
        return pd.Series(dtype=float)
    aligned = clean_rate.reindex(values.index, method='ffill')
    return (values * aligned).dropna()


def accumulated_level_from_daily_rates(daily_percent: pd.Series) -> pd.Series:
    """The CDI as a level: each day's rate, in percent, compounded."""
    return (1 + daily_percent.fillna(0) / 100).cumprod()


def annualized_rate_from_daily(daily_percent: pd.Series, *, business_days: int = 252) -> pd.Series:
    """The annual rate a daily rate stands for, as a fraction per year."""
    return (1 + daily_percent / 100) ** business_days - 1


def trailing_twelve_months(level: pd.Series) -> pd.Series:
    """Change of a level over the twelve months up to each observation."""
    clean = level.dropna().sort_index()
    if clean.empty:
        return pd.Series(dtype=float)
    past = clean.reindex(clean.index - pd.DateOffset(years=1), method='ffill')
    past.index = clean.index
    change = clean / past - 1
    return change[clean.index >= clean.index[0] + pd.DateOffset(years=1)]


def real_rate(nominal_12m: pd.Series, inflation_12m: pd.Series) -> pd.Series:
    """Fisher: what the nominal return buys once inflation is taken out.

    Each week takes the last inflation month on record by then. Inflation is
    dated by its reference month, not by when it was published about ten days
    later, so for those days the reading uses a figure that was not yet out.
    Over a twelve-month window that is noise, not a bias worth a calendar.
    """
    nominal = nominal_12m.dropna().sort_index()
    inflation = inflation_12m.dropna().sort_index()
    if nominal.empty or inflation.empty:
        return pd.Series(dtype=float)
    aligned = inflation.reindex(nominal.index, method='ffill')
    return ((1 + nominal) / (1 + aligned) - 1).dropna()


def _last_per_period(values: pd.Series, period: str) -> pd.Series:
    if values.empty:
        return values
    periods = values.index.to_period(period)
    return values[~periods.duplicated(keep='last')]


def _return_since(weekly: pd.Series, start: pd.Timestamp) -> float | None:
    before = weekly[weekly.index <= start]
    if before.empty:
        return None
    return float(weekly.iloc[-1] / before.iloc[-1] - 1)


def _annualized_since(weekly: pd.Series, *, years: int) -> float | None:
    total = _return_since(weekly, weekly.index[-1] - pd.DateOffset(years=years))
    if total is None:
        return None
    return float((1 + total) ** (1 / years) - 1)


def _annualized_since_start(weekly: pd.Series) -> float | None:
    days = (weekly.index[-1] - weekly.index[0]).days
    if days < MIN_DAYS_TO_ANNUALIZE:
        return None
    return float((weekly.iloc[-1] / weekly.iloc[0]) ** (365.25 / days) - 1)


def _annualized_rolling(weekly: pd.Series, *, years: int) -> pd.Series:
    periods = years * WEEKS_PER_YEAR
    return (weekly / weekly.shift(periods)) ** (1 / years) - 1


def _chart_value(value: object) -> float | None:
    """Six significant digits: more than a line drawn on screen can show, and
    a third of the payload of a full double."""
    number = _float_or_none(value)
    return None if number is None else float(f'{number:.6g}')


def _float_or_none(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)
