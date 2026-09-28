from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY
from app.modules.market_data.domain.reference_etfs import (
    REFERENCE_ETFS,
    EtfExposure,
    EtfListing,
)
from app.modules.market_data.service.market_reading_service import (
    ETF_HISTORY_WEEKS,
    MarketReadingService,
)


def test_each_reference_etf_is_listed_once_and_every_exposure_has_one():
    tickers = [etf.ticker for etf in REFERENCE_ETFS]
    assert len(tickers) == len(set(tickers))
    assert {etf.exposure for etf in REFERENCE_ETFS} == set(EtfExposure)
    # A UCITS fund is the London listing, and its ticker says so.
    assert all(
        etf.ticker.endswith('.L') for etf in REFERENCE_ETFS if etf.listing == EtfListing.UCITS
    )


class FakeUoW:
    def __init__(self, *, assets: list, quotes: list, latest: dict | None = None):
        self.assets = SimpleNamespace(get_by_tickers=AsyncMock(return_value=assets))
        self.quotes = SimpleNamespace(
            get_adjusted_prices=AsyncMock(return_value=quotes),
            get_latest_quote_dates=AsyncMock(return_value=latest or {}),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None


def service(uow: FakeUoW) -> MarketReadingService:
    return MarketReadingService(uow=uow, usd_brl=SimpleNamespace())


@pytest.mark.asyncio
async def test_etf_reading_uses_the_adjusted_close_and_keeps_a_year_of_history():
    days = pd.bdate_range('2020-01-01', '2026-09-25')
    # The adjusted close grows with the dividends; the repository hands it
    # over in place of the close.
    quotes = [
        (7, day.date(), 100.0 * (1 + index / 1000), CURRENCY.USD) for index, day in enumerate(days)
    ]
    uow = FakeUoW(
        assets=[SimpleNamespace(id=7, ticker='VT', name='Vanguard Total World')], quotes=quotes
    )

    readings = await service(uow).get_reference_etf_readings()

    assert [reading.ticker for reading in readings] == ['VT']
    vt = readings[0]
    assert vt.exposure == EtfExposure.WORLD
    assert vt.currency == 'USD'
    assert vt.reading.one_year_return > 0
    assert vt.day_change == pytest.approx(
        (1 + (len(days) - 1) / 1000) / (1 + (len(days) - 2) / 1000) - 1
    )
    assert len(vt.reading.history) == ETF_HISTORY_WEEKS
    uow.assets.get_by_tickers.assert_awaited_once()
    assert uow.assets.get_by_tickers.await_args.kwargs == {'asset_type_id': ASSET_TYPE.ETF}


@pytest.mark.asyncio
async def test_etf_without_quotes_is_left_out_of_the_readings():
    uow = FakeUoW(assets=[SimpleNamespace(id=7, ticker='VT', name='VT')], quotes=[])

    assert await service(uow).get_reference_etf_readings() == []


@pytest.mark.asyncio
async def test_selection_sends_an_unpriced_etf_for_its_whole_history():
    uow = FakeUoW(
        assets=[SimpleNamespace(id=7, ticker='VT'), SimpleNamespace(id=3, ticker='IVV')],
        quotes=[],
        latest={3: date(2026, 9, 25)},
    )

    selection = await service(uow).get_reference_etf_selection()

    assert selection.priced == [3]
    assert selection.unpriced == [7]
