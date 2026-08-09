from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.service.quote_ingestion_service import QuoteIngestionService

EXECUTION_ID = 12


def build_tracker(prepare_return):
    return SimpleNamespace(
        prepare_execution=AsyncMock(return_value=prepare_return),
        set_execution_items=AsyncMock(),
        finish=AsyncMock(),
        fail=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_quote_runner_ingests_the_asset_ids_it_is_given():
    tracker = build_tracker((EXECUTION_ID, False, []))
    quote_service = SimpleNamespace(ingest_quotes=AsyncMock())
    service = QuoteIngestionService(ingestion_service=tracker, quote_service=quote_service)

    execution_id = await service.run(execution_id=EXECUTION_ID, asset_ids=[10, 20])

    assert execution_id == EXECUTION_ID
    quote_service.ingest_quotes.assert_awaited_once_with(
        asset_ids=[10, 20],
        force_full_history=False,
        execution_id=EXECUTION_ID,
    )
    tracker.finish.assert_awaited_once_with(EXECUTION_ID)


@pytest.mark.asyncio
async def test_quote_runner_records_caller_supplied_selection_parameters():
    tracker = build_tracker((EXECUTION_ID, False, []))
    service = QuoteIngestionService(
        ingestion_service=tracker,
        quote_service=SimpleNamespace(ingest_quotes=AsyncMock()),
    )

    await service.run(
        execution_id=EXECUTION_ID,
        asset_ids=[10],
        selection_parameters={'selection': 'recent positions', 'position_window_days': 5},
    )

    _, kwargs = tracker.set_execution_items.await_args
    assert kwargs['parameters']['selection'] == 'recent positions'
    assert kwargs['parameters']['position_window_days'] == 5
    assert kwargs['item_ids'] == [10]


@pytest.mark.asyncio
async def test_quote_runner_honors_ids_stored_on_the_execution():
    tracker = build_tracker((13, True, [99]))
    quote_service = SimpleNamespace(ingest_quotes=AsyncMock())
    service = QuoteIngestionService(ingestion_service=tracker, quote_service=quote_service)

    await service.run(execution_id=13, asset_ids=[1, 2, 3])

    quote_service.ingest_quotes.assert_awaited_once_with(
        asset_ids=[99],
        force_full_history=True,
        execution_id=13,
    )


@pytest.mark.asyncio
async def test_quote_runner_skips_the_provider_when_no_asset_was_selected():
    tracker = build_tracker((EXECUTION_ID, False, []))
    quote_service = SimpleNamespace(ingest_quotes=AsyncMock())
    service = QuoteIngestionService(ingestion_service=tracker, quote_service=quote_service)

    await service.run(execution_id=EXECUTION_ID, asset_ids=[])

    quote_service.ingest_quotes.assert_not_awaited()
    tracker.finish.assert_awaited_once_with(EXECUTION_ID)


@pytest.mark.asyncio
async def test_quote_runner_records_failure_through_generic_tracker():
    tracker = build_tracker((14, False, [10]))
    quote_service = SimpleNamespace(
        ingest_quotes=AsyncMock(side_effect=RuntimeError('provider failed')),
    )
    service = QuoteIngestionService(ingestion_service=tracker, quote_service=quote_service)

    with pytest.raises(RuntimeError, match='provider failed'):
        await service.run(execution_id=14)

    tracker.fail.assert_awaited_once()
