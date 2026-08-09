from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.quote import Quote, persisted_close_prices_df
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
        )
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
    provider.fetch_quotes.assert_not_awaited()
    assert result.iloc[-1]['close'] == PERSISTED_CLOSE


@pytest.mark.asyncio
async def test_missing_persisted_history_is_explicit():
    quote_repository = SimpleNamespace(get_quotes=AsyncMock(return_value=[]))
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
