from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.service.quote_ingestion_service import QuoteIngestionService
from app.modules.portfolio.domain.quote_ingestion import QuoteIngestionAssetSelection

EXECUTION_ID = 12


@pytest.mark.asyncio
async def test_quote_runner_uses_generic_tracker_and_recent_portfolio_selection():
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(EXECUTION_ID, False, [])),
        set_execution_items=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
    )
    selection = QuoteIngestionAssetSelection(
        asset_ids=[10, 20],
        position_reference_date=date(2026, 8, 8),
        position_window_days=5,
        description='recent positions',
    )
    portfolio_service = SimpleNamespace(
        get_assets_requiring_quote_ingestion=AsyncMock(return_value=selection),
    )
    quote_service = SimpleNamespace(ingest_quotes=AsyncMock())
    service = QuoteIngestionService(
        ingestion_service=tracker,
        quote_service=quote_service,
        portfolio_service=portfolio_service,
    )

    execution_id = await service.run(execution_id=EXECUTION_ID)

    assert execution_id == EXECUTION_ID
    portfolio_service.get_assets_requiring_quote_ingestion.assert_awaited_once()
    quote_service.ingest_quotes.assert_awaited_once_with(
        asset_ids=[10, 20],
        force_full_history=False,
        execution_id=EXECUTION_ID,
    )
    tracker.finish.assert_awaited_once_with(EXECUTION_ID)


@pytest.mark.asyncio
async def test_quote_runner_honors_explicit_ids_without_portfolio_selection():
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(13, True, [99])),
        set_execution_items=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
    )
    portfolio_service = SimpleNamespace(
        get_assets_requiring_quote_ingestion=AsyncMock(),
    )
    quote_service = SimpleNamespace(ingest_quotes=AsyncMock())
    service = QuoteIngestionService(
        ingestion_service=tracker,
        quote_service=quote_service,
        portfolio_service=portfolio_service,
    )

    await service.run(execution_id=13)

    portfolio_service.get_assets_requiring_quote_ingestion.assert_not_awaited()
    quote_service.ingest_quotes.assert_awaited_once_with(
        asset_ids=[99],
        force_full_history=True,
        execution_id=13,
    )


@pytest.mark.asyncio
async def test_quote_runner_records_failure_through_generic_tracker():
    tracker = SimpleNamespace(
        prepare_execution=AsyncMock(return_value=(14, False, [10])),
        set_execution_items=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
    )
    quote_service = SimpleNamespace(
        ingest_quotes=AsyncMock(side_effect=RuntimeError('provider failed')),
    )
    service = QuoteIngestionService(
        ingestion_service=tracker,
        quote_service=quote_service,
        portfolio_service=SimpleNamespace(),
    )

    with pytest.raises(RuntimeError, match='provider failed'):
        await service.run(execution_id=14)

    tracker.fail.assert_awaited_once()
