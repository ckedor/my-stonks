from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.domain.quote import FetchedQuotes, Quote
from app.modules.market_data.service.quote_service import (
    OnDemandQuoteReadService,
    PersistedQuoteReadService,
)

ASSET_ID = 7
PERSISTED_CLOSE = 32.5
ON_DEMAND_CLOSE = 100_000


@pytest.mark.asyncio
async def test_persisted_quote_read_uses_only_registered_assets_and_database():
    asset = SimpleNamespace(id=ASSET_ID, ticker='PETR4', asset_type_id=4)
    asset_repository = SimpleNamespace(
        get_by_ids=AsyncMock(return_value=[asset]),
        get_by_tickers=AsyncMock(),
    )
    quote_repository = SimpleNamespace(
        get_quotes=AsyncMock(
            return_value=[
                Quote(
                    asset_id=ASSET_ID,
                    date=date(2026, 8, 8),
                    close=PERSISTED_CLOSE,
                    source='source',
                )
            ]
        )
    )
    service = PersistedQuoteReadService(
        asset_repository=asset_repository,
        quote_repository=quote_repository,
    )

    result = await service.get_quotes(asset_ids=[ASSET_ID])

    asset_repository.get_by_ids.assert_awaited_once_with([ASSET_ID])
    quote_repository.get_quotes.assert_awaited_once_with(
        [ASSET_ID],
        start_date=None,
    )
    assert result[0]['asset_id'] == ASSET_ID
    assert result[0]['quotes'][0]['close'] == PERSISTED_CLOSE


@pytest.mark.asyncio
async def test_persisted_quote_read_rejects_ambiguous_identity_and_missing_assets():
    service = PersistedQuoteReadService(
        asset_repository=SimpleNamespace(get_by_ids=AsyncMock(return_value=[])),
        quote_repository=SimpleNamespace(get_quotes=AsyncMock()),
    )

    with pytest.raises(ValidationError):
        await service.get_quotes()
    with pytest.raises(NotFoundError):
        await service.get_quotes(asset_ids=[999])


@pytest.mark.asyncio
async def test_on_demand_quote_read_calls_only_provider_and_does_not_persist():
    provider = SimpleNamespace(
        fetch_quotes=AsyncMock(
            return_value=FetchedQuotes(
                ticker='BTC',
                currency='USD',
                source='source',
                parameters={},
                quotes=[Quote(date=date(2026, 8, 8), close=ON_DEMAND_CLOSE)],
            )
        ),
        close=AsyncMock(),
    )
    service = OnDemandQuoteReadService(provider)

    result = await service.get_quotes(ticker='BTC', asset_type_id=13)

    provider.fetch_quotes.assert_awaited_once_with(
        ticker='BTC',
        asset_type_id=13,
        start_date=None,
        exchange=None,
    )
    assert result['ticker'] == 'BTC'
    assert result['quotes'][0]['close'] == ON_DEMAND_CLOSE
