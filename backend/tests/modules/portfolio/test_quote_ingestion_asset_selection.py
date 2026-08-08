from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    RECENT_POSITION_WINDOW_DAYS,
    PortfolioQuoteIngestionService,
)


@pytest.mark.asyncio
async def test_incremental_selection_uses_portfolio_recent_position_rule():
    repository = SimpleNamespace(
        get_latest_position_date=AsyncMock(return_value=date(2026, 8, 8)),
        get_recent_position_asset_ids=AsyncMock(return_value=[10, 20]),
    )
    service = PortfolioQuoteIngestionService(repository)

    selection = await service.get_assets_requiring_quote_ingestion(
        full_history=False,
        asset_type_ids=[1, 2],
    )

    repository.get_recent_position_asset_ids.assert_awaited_once_with(
        window_days=RECENT_POSITION_WINDOW_DAYS,
        asset_type_ids=[1, 2],
    )
    assert selection.asset_ids == [10, 20]
    assert selection.position_window_days == RECENT_POSITION_WINDOW_DAYS
    assert selection.position_reference_date == date(2026, 8, 8)


@pytest.mark.asyncio
async def test_full_selection_uses_all_portfolio_transactions():
    repository = SimpleNamespace(
        get_all_asset_ids_with_transactions=AsyncMock(return_value=[10, 30]),
    )
    service = PortfolioQuoteIngestionService(repository)

    selection = await service.get_assets_requiring_quote_ingestion(
        full_history=True,
        asset_type_ids=[1, 2],
    )

    repository.get_all_asset_ids_with_transactions.assert_awaited_once_with(
        asset_type_ids=[1, 2],
    )
    assert selection.asset_ids == [10, 30]
    assert selection.position_window_days is None
    assert selection.position_reference_date is None
