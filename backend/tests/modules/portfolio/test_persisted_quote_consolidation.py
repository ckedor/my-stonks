from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.quote import Quote
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)

PERSISTED_CLOSE = 31.25


@pytest.mark.asyncio
async def test_persisted_close_price_read_never_calls_provider():
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
    service = MarketDataReadService(
        quote_repository=quote_repository,
        provider=provider,
    )

    result = await service.get_asset_close_prices(
        asset_id=7,
        ticker='PETR4',
        init_date=pd.Timestamp(date.today()),
    )

    quote_repository.get_quotes.assert_awaited_once_with([7], start_date=date.today())
    provider.fetch_quotes.assert_not_awaited()
    assert result.iloc[0]['close'] == PERSISTED_CLOSE


@pytest.mark.asyncio
async def test_missing_persisted_history_is_explicit():
    service = MarketDataReadService(
        quote_repository=SimpleNamespace(get_quotes=AsyncMock(return_value=[])),
    )

    with pytest.raises(NotFoundError, match='No persisted quotes'):
        await service.get_asset_close_prices(
            asset_id=7,
            ticker='PETR4',
            init_date=pd.Timestamp(date.today()),
        )


@pytest.mark.asyncio
async def test_variable_income_consolidation_delegates_to_persisted_quote_reader():
    expected = pd.DataFrame([
        {
            'date': pd.Timestamp(date.today()),
            'close': PERSISTED_CLOSE,
            'currency': 1,
        }
    ])
    read_service = SimpleNamespace(get_asset_close_prices=AsyncMock(return_value=expected))
    repository = SimpleNamespace()
    quote_repository = SimpleNamespace()
    service = PortfolioConsolidatorService(
        repository=repository,
        market_data_service=read_service,
    )
    asset = SimpleNamespace(
        id=7,
        ticker='PETR4',
        asset_type=SimpleNamespace(id=4),
    )

    result = await service._get_asset_prices(
        asset,
        transaction_rows=[],
        dividends_df=pd.DataFrame(),
        init_date=pd.Timestamp(date.today()),
        repository=repository,
        quote_repository=quote_repository,
    )

    read_service.get_asset_close_prices.assert_awaited_once_with(
        asset_id=7,
        ticker='PETR4',
        init_date=pd.Timestamp(date.today()),
        quote_repository=quote_repository,
    )
    assert result is expected
