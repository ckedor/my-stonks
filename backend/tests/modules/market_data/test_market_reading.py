from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.constants import SERIES
from app.modules.market_data.domain.market_reading import (
    chart_points,
    level_reading,
    rate_reading,
    ratio,
    real_rate,
    restated,
    trailing_twelve_months,
    weekly_closes,
)
from app.modules.market_data.service.market_reading_service import MarketReadingService


def weekly(values: list[float], *, start: str = '2020-01-03') -> pd.Series:
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq='W-FRI'))


def test_weekly_close_keeps_the_day_it_was_observed():
    # Bitcoin trades on Sunday. Labelled by its week's Friday, this close would
    # be dated five days in the future.
    daily = pd.Series(
        [100.0, 101.0, 102.0],
        index=pd.to_datetime(['2026-09-24', '2026-09-25', '2026-09-27']),
    )

    result = weekly_closes(daily)

    assert result.index.tolist() == [pd.Timestamp('2026-09-25'), pd.Timestamp('2026-09-27')]
    assert result.tolist() == [101.0, 102.0]


def test_level_reading_measures_returns_trend_and_drawdown():
    # Two years of steady weekly growth, then a fall from the peak.
    values = [100 * 1.01**week for week in range(104)] + [150.0]
    series = weekly(values)

    reading = level_reading('msci_world', series, series_id=SERIES.MSCI_WORLD)

    peak = max(values)
    assert reading.value == 150.0
    assert reading.drawdown == pytest.approx(150 / peak - 1)
    # 52 weeks are 364 days: the close a calendar year back is the week before.
    assert reading.one_year_return == pytest.approx(150 / values[-1 - 53] - 1)
    assert reading.moving_average == pytest.approx(sum(values[-40:]) / 40)
    assert reading.distance_to_moving_average == pytest.approx(150 / reading.moving_average - 1)
    # A fall below trend after two years above it: the lowest distance on record.
    assert reading.distance_percentile == pytest.approx(1 / (len(values) - 39))
    assert reading.ten_year_annualized_return is None
    assert reading.ten_year_return_percentile is None
    assert reading.series_id == SERIES.MSCI_WORLD


def test_percentile_needs_a_year_of_history():
    reading = level_reading('short', weekly([100.0 + week for week in range(45)]))

    assert reading.moving_average is not None
    assert reading.distance_percentile is None


def test_ratio_is_rebased_on_the_weeks_both_series_have():
    usa = weekly([10.0, 12.0, 15.0])
    world = weekly([20.0, 20.0], start='2020-01-10')

    result = ratio(usa, world)

    assert result.index.tolist() == world.index.tolist()
    assert result.tolist() == [100.0, 125.0]


def test_real_rate_takes_inflation_out_by_fisher():
    nominal = pd.Series([0.12], index=pd.to_datetime(['2026-09-25']))
    inflation = pd.Series([0.05, 0.04], index=pd.to_datetime(['2026-07-01', '2026-08-01']))

    result = real_rate(nominal, inflation)

    assert result.iloc[0] == pytest.approx(1.12 / 1.04 - 1)


def test_twelve_month_change_starts_once_a_year_exists():
    level = pd.Series(
        [100.0, 105.0, 110.0],
        index=pd.to_datetime(['2025-01-01', '2025-06-01', '2026-01-01']),
    )

    result = trailing_twelve_months(level)

    assert result.index.tolist() == [pd.Timestamp('2026-01-01')]
    assert result.iloc[0] == pytest.approx(0.10)


def test_growth_since_start_is_annualized_over_the_whole_history():
    series = pd.Series(
        [100.0, 150.0, 121.0],
        index=pd.to_datetime(['2020-01-03', '2021-01-01', '2022-01-03']),
    )

    reading = level_reading('msci_world', series)

    days = (series.index[-1] - series.index[0]).days
    assert reading.since_start_annualized_return == pytest.approx(1.21 ** (365.25 / days) - 1)


def test_growth_since_start_is_not_annualized_under_a_year():
    reading = level_reading('short', weekly([100.0, 110.0, 120.0]))

    assert reading.since_start_annualized_return is None


def test_restated_level_uses_the_last_rate_known_that_day():
    ibovespa = pd.Series(
        [100_000.0, 120_000.0, 130_000.0],
        index=pd.to_datetime(['1994-06-30', '2026-09-24', '2026-09-25']),
    )
    brl_usd = pd.Series([0.25, 0.20], index=pd.to_datetime(['1994-07-01', '2026-09-24']))

    result = restated(ibovespa, brl_usd)

    # Before the first rate there is nothing to convert with: dropped, not kept in reais.
    assert result.index.tolist() == [pd.Timestamp('2026-09-24'), pd.Timestamp('2026-09-25')]
    assert result.tolist() == [24_000.0, 26_000.0]


def test_chart_keeps_recent_weeks_and_one_point_a_month_before():
    series = weekly([float(week) for week in range(7 * 52)])

    points = chart_points(series)

    cutoff = series.index[-1] - pd.DateOffset(years=5)
    recent = points[points.index >= cutoff]
    older = points[points.index < cutoff]
    assert len(recent) == len(series[series.index >= cutoff])
    assert older.index.to_period('M').is_unique
    assert points.index[-1] == series.index[-1]


def test_rate_reading_compares_with_a_year_before():
    series = weekly([0.10] * 54 + [0.15])

    reading = rate_reading('cdi', series)

    assert reading.value == 0.15
    assert reading.one_year_ago == 0.10
    assert reading.percentile == 1.0


class FakeUoW:
    def __init__(self, *, series: dict, bitcoin_quotes: list):
        self.market_data = SimpleNamespace(
            get_series_history_entries=AsyncMock(
                side_effect=lambda series_id: series.get(series_id, [])
            )
        )
        self.assets = SimpleNamespace(
            get_by_tickers=AsyncMock(
                return_value=[SimpleNamespace(id=13)] if bitcoin_quotes else []
            )
        )
        self.quotes = SimpleNamespace(get_quotes=AsyncMock(return_value=bitcoin_quotes))

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None


@pytest.mark.asyncio
async def test_dollar_is_read_from_the_real_on_not_from_cruzeiros():
    # The table keeps 1990s cruzeiros unscaled: read from there, the all-time
    # high is a cruzeiro and the dollar is always 100% below it.
    usd_brl = [
        {'date': '1993-01-04', 'usd_brl': '12387', 'brl_usd': '0.0000807'},
        *[
            {'date': day.date().isoformat(), 'usd_brl': '5.0', 'brl_usd': '0.2'}
            for day in pd.date_range('2025-01-03', periods=60, freq='W-FRI')
        ],
    ]
    service = MarketReadingService(
        uow=FakeUoW(series={}, bitcoin_quotes=[]),
        usd_brl=SimpleNamespace(get_full_history=AsyncMock(return_value=usd_brl)),
    )

    readings = await service.get_world_readings()

    dollar = next(reading for reading in readings.levels if reading.key == 'usd_brl')
    assert dollar.since >= date(1994, 7, 1)
    assert dollar.drawdown == 0.0
    assert readings.comparisons == []
    assert readings.rates == []


@pytest.mark.asyncio
async def test_cdi_rate_skips_days_without_a_session():
    # 2026-04-03 was Good Friday: stored as 0%, it would close the week at 0% a year.
    cdi = [
        SimpleNamespace(date=day.date(), close=0.0 if day == pd.Timestamp('2026-04-03') else 0.05)
        for day in pd.bdate_range('2026-03-02', '2026-04-03')
    ]
    service = MarketReadingService(
        uow=FakeUoW(series={SERIES.CDI: cdi}, bitcoin_quotes=[]),
        usd_brl=SimpleNamespace(get_full_history=AsyncMock(return_value=[])),
    )

    readings = await service.get_world_readings()

    cdi_reading = next(reading for reading in readings.rates if reading.key == 'cdi')
    assert cdi_reading.as_of == date(2026, 4, 2)
    assert cdi_reading.value == pytest.approx(1.0005**252 - 1)
    assert cdi_reading.series_id == SERIES.CDI


@pytest.mark.asyncio
async def test_brazil_reads_in_dollars_and_links_to_the_ibovespa():
    days = pd.date_range('2025-01-03', periods=60, freq='W-FRI')
    ibovespa = [SimpleNamespace(date=day.date(), close=100_000.0) for day in days]
    usd_brl = [{'date': day.date().isoformat(), 'usd_brl': '5.0', 'brl_usd': '0.2'} for day in days]
    service = MarketReadingService(
        uow=FakeUoW(series={SERIES.IBOVESPA: ibovespa}, bitcoin_quotes=[]),
        usd_brl=SimpleNamespace(get_full_history=AsyncMock(return_value=usd_brl)),
    )

    readings = await service.get_world_readings()

    brazil = next(reading for reading in readings.levels if reading.key == 'ibovespa_usd')
    assert brazil.value == pytest.approx(20_000.0)
    assert brazil.series_id == SERIES.IBOVESPA


@pytest.mark.asyncio
async def test_bitcoin_reading_points_at_its_asset():
    quotes = [
        SimpleNamespace(date=day.date(), close=50_000.0)
        for day in pd.date_range('2025-01-05', periods=60, freq='W-SUN')
    ]
    service = MarketReadingService(
        uow=FakeUoW(series={}, bitcoin_quotes=quotes),
        usd_brl=SimpleNamespace(get_full_history=AsyncMock(return_value=[])),
    )

    readings = await service.get_world_readings()

    bitcoin = next(reading for reading in readings.levels if reading.key == 'btc')
    assert bitcoin.asset_id == 13
    assert bitcoin.series_id is None


@pytest.mark.asyncio
async def test_gold_reads_as_a_level_that_links_to_its_series():
    gold = [
        SimpleNamespace(date=day.date(), close=4_000.0)
        for day in pd.date_range('2025-01-03', periods=60, freq='W-FRI')
    ]
    service = MarketReadingService(
        uow=FakeUoW(series={SERIES.GOLD: gold}, bitcoin_quotes=[]),
        usd_brl=SimpleNamespace(get_full_history=AsyncMock(return_value=[])),
    )

    readings = await service.get_world_readings()

    reading = next(reading for reading in readings.levels if reading.key == 'gold')
    assert reading.value == 4_000.0
    assert reading.series_id == SERIES.GOLD
