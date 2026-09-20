from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.modules.market_data.service.fund_share_value_ingestion_service import FundShareValueRun
from app.modules.market_data.tasks import ingest_fund_share_values as task


def runner(result: FundShareValueRun):
    service = SimpleNamespace(run=AsyncMock(return_value=result))

    @asynccontextmanager
    async def context():
        yield service

    return service, context


@pytest.mark.asyncio
async def test_changed_share_values_dispatch_a_full_recalculation_by_name():
    service, context = runner(FundShareValueRun(execution_id=3, changed={9: date(2026, 4, 1)}))

    with (
        patch.object(task, 'fund_share_value_ingestion_runner_context', context),
        patch.object(task, 'run_task_by_name') as dispatch,
    ):
        result = await task.ingest_fund_share_values.run.__wrapped__(
            fund_asset_ids_since={'9': '2026-03-02'}, execution_id=3
        )

    assert result == 3
    service.run.assert_awaited_once()
    assert service.run.await_args.kwargs['fund_asset_ids_since'] == {9: date(2026, 3, 2)}
    dispatch.assert_called_once_with('recalculate_positions_for_assets', [9])


@pytest.mark.asyncio
async def test_a_run_that_changed_nothing_dispatches_nothing():
    _, context = runner(FundShareValueRun(execution_id=3))

    with (
        patch.object(task, 'fund_share_value_ingestion_runner_context', context),
        patch.object(task, 'run_task_by_name') as dispatch,
    ):
        await task.ingest_fund_share_values.run.__wrapped__(fund_asset_ids_since={})

    dispatch.assert_not_called()
