"""Market reading schemas."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ReadingPointResponse(BaseModel):
    date: date
    value: float
    moving_average: float | None = None

    model_config = ConfigDict(from_attributes=True)


class LevelReadingResponse(BaseModel):
    """A level against its own weekly history. Returns and distances are
    fractions; percentiles run from 0 to 1."""

    key: str
    series_id: int | None = None
    asset_id: int | None = None
    as_of: date
    since: date
    value: float
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
    history: list[ReadingPointResponse]

    model_config = ConfigDict(from_attributes=True)


class RateReadingResponse(BaseModel):
    """A rate, as a fraction per year, against its own weekly history."""

    key: str
    series_id: int | None = None
    as_of: date
    since: date
    value: float
    one_year_ago: float | None
    percentile: float | None
    history: list[ReadingPointResponse]

    model_config = ConfigDict(from_attributes=True)


class WorldMarketReadingsResponse(BaseModel):
    levels: list[LevelReadingResponse]
    comparisons: list[LevelReadingResponse]
    rates: list[RateReadingResponse]

    model_config = ConfigDict(from_attributes=True)


class ReferenceEtfReadingResponse(BaseModel):
    """A reference ETF read on its adjusted close — dividends in, as in the
    MSCI net indexes. `reading.history` is the last year only, for a sparkline;
    `day_change` is the last close against the one before, a fraction."""

    ticker: str
    name: str
    asset_id: int
    exposure: Literal[
        'usa',
        'world',
        'world_ex_usa',
        'emerging',
        'dividends',
        'themes',
        'bonds',
        'gold',
        'real_estate',
    ]
    listing: Literal['us', 'ucits']
    currency: str | None
    day_change: float | None
    reading: LevelReadingResponse

    model_config = ConfigDict(from_attributes=True)
