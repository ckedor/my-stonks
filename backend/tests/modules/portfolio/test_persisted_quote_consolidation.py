from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.quote import Quote, persisted_close_prices_df
from app.modules.portfolio.domain.portfolio_consolidation import consolidate_positions
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)

PERSISTED_CLOSE = 31.25


def test_persisted_close_prices_use_the_quote_currency():
    quotes = [
        Quote(
            asset_id=7,
            currency_id=1,
            date=date.today(),
            close=PERSISTED_CLOSE,
        )
    ]

    result = persisted_close_prices_df(quotes)

    assert result.iloc[-1]['close'] == PERSISTED_CLOSE
    assert result.iloc[-1]['currency'] == 1


def test_persisted_close_prices_are_empty_without_a_close():
    quotes = [Quote(asset_id=7, currency_id=1, date=date.today(), close=None)]

    assert persisted_close_prices_df(quotes).empty
    assert persisted_close_prices_df([]).empty


@pytest.mark.asyncio
async def test_variable_income_consolidation_reads_persisted_quotes_only():
    quote_repository = SimpleNamespace(
        get_quotes=AsyncMock(
            return_value=[
                Quote(
                    asset_id=7,
                    currency_id=1,
                    date=date.today(),
                    close=PERSISTED_CLOSE,
                )
            ]
        ),
        get_latest_quote_on_or_before=AsyncMock(),
    )
    provider = SimpleNamespace(fetch_quotes=AsyncMock())
    asset = SimpleNamespace(id=7, ticker='PETR4', asset_type=SimpleNamespace(id=4))

    result = await PortfolioConsolidatorService._get_asset_prices(
        asset,
        transaction_rows=[],
        dividends_df=pd.DataFrame(),
        init_date=pd.Timestamp(date.today()),
        repository=SimpleNamespace(),
        quote_repository=quote_repository,
    )

    quote_repository.get_quotes.assert_awaited_once_with([7], start_date=date.today())
    quote_repository.get_latest_quote_on_or_before.assert_not_awaited()
    provider.fetch_quotes.assert_not_awaited()
    assert result.iloc[-1]['close'] == PERSISTED_CLOSE


@pytest.mark.asyncio
async def test_missing_persisted_history_is_explicit():
    quote_repository = SimpleNamespace(
        get_quotes=AsyncMock(return_value=[]),
        get_latest_quote_on_or_before=AsyncMock(return_value=None),
    )
    asset = SimpleNamespace(id=7, ticker='PETR4', asset_type=SimpleNamespace(id=4))

    with pytest.raises(NotFoundError, match='No persisted quotes'):
        await PortfolioConsolidatorService._get_asset_prices(
            asset,
            transaction_rows=[],
            dividends_df=pd.DataFrame(),
            init_date=pd.Timestamp(date.today()),
            repository=SimpleNamespace(),
            quote_repository=quote_repository,
        )


@pytest.mark.asyncio
async def test_a_buy_without_a_quote_that_day_is_priced_by_the_last_earlier_quote():
    """A share value filed on D-3 prices a buy on D until the next filing.

    The quotes read from the buy onwards are empty (a monthly fund has not filed
    since), so without the seed every day is unpriced and the position refused.
    """
    today = pd.Timestamp(date.today())
    buy_day = today - pd.Timedelta(days=5)
    seed_day = buy_day - pd.Timedelta(days=3)
    quote_repository = SimpleNamespace(
        get_quotes=AsyncMock(return_value=[]),
        get_latest_quote_on_or_before=AsyncMock(
            return_value=Quote(asset_id=7, currency_id=1, date=seed_day.date(), close=1.42053670)
        ),
    )
    asset = SimpleNamespace(id=7, ticker=None, asset_type=SimpleNamespace(id=6))
    rows = [{'date': buy_day, 'quantity': 1000, 'price': 1.43, 'price_usd': 0.26}]

    prices = await PortfolioConsolidatorService._get_asset_prices(
        asset,
        transaction_rows=rows,
        dividends_df=pd.DataFrame(),
        init_date=buy_day,
        repository=SimpleNamespace(),
        quote_repository=quote_repository,
    )
    fx = pd.DataFrame({'date': pd.date_range(seed_day, today), 'usd_brl': 5.0, 'brl_usd': 0.2})
    position = consolidate_positions(rows, [], prices, fx, pd.DataFrame())

    quote_repository.get_latest_quote_on_or_before.assert_awaited_once_with(7, buy_day.date())
    PortfolioConsolidatorService._reject_unpriced_positions(position, asset)
    assert position['date'].min() == buy_day
    assert position['price'].tolist() == [1.42053670] * len(position)
