from contextlib import asynccontextmanager
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.core.exceptions import BusinessRuleError
from app.modules.market_data.service.fund_share_value_ingestion_service import FundShareValueRun
from app.modules.portfolio.tasks import recalculate_asset_position as task


@pytest.fixture
def workflow(monkeypatch):
    events = []
    selection = SimpleNamespace(
        get_funds_requiring_share_values=AsyncMock(
            return_value=SimpleNamespace(since={9: date(2026, 9, 10)})
        ),
        get_positions_to_recalculate=AsyncMock(return_value=[(1, 9), (2, 9)]),
    )
    outcome = FundShareValueRun(execution_id=3, succeeded={9})

    async def ingest(**kwargs):
        events.append('ingest')
        return outcome

    async def consolidate(*args):
        events.append('consolidate')

    ingestion = SimpleNamespace(run=AsyncMock(side_effect=ingest))
    consolidator = SimpleNamespace(recalculate_position_asset=AsyncMock(side_effect=consolidate))
    positions = SimpleNamespace(invalidate_patrimony_evolution=AsyncMock())

    @asynccontextmanager
    async def ingestion_context():
        yield ingestion

    @asynccontextmanager
    async def consolidation_context():
        yield consolidator

    monkeypatch.setattr(task, 'build_portfolio_quote_ingestion_service', lambda: selection)
    monkeypatch.setattr(task, 'fund_share_value_ingestion_runner_context', ingestion_context)
    monkeypatch.setattr(task, 'portfolio_consolidator_service_context', consolidation_context)
    monkeypatch.setattr(task, 'build_portfolio_position_service_for_task', lambda: positions)
    dispatch, returns = Mock(), Mock()
    monkeypatch.setattr(task, 'run_task_by_name', dispatch)
    monkeypatch.setattr(task, 'run_task', returns)
    return SimpleNamespace(
        events=events,
        selection=selection,
        outcome=outcome,
        ingestion=ingestion,
        consolidator=consolidator,
        positions=positions,
        dispatch=dispatch,
        returns=returns,
    )


async def test_imports_before_consolidating_even_when_quotes_were_unchanged(workflow):
    await task.recalculate_position_asset.run.__wrapped__(1, 9)
    assert workflow.events == ['ingest', 'consolidate']
    workflow.ingestion.run.assert_awaited_once_with(fund_asset_ids_since={9: date(2026, 9, 10)})
    workflow.positions.invalidate_patrimony_evolution.assert_awaited_once_with(1)
    workflow.returns.assert_called_once()


async def test_changed_prices_rebuild_other_portfolios_without_reimporting(workflow):
    workflow.outcome.changed = {9: date(2026, 7, 31)}
    await task.recalculate_position_asset.run.__wrapped__(1, 9)
    workflow.dispatch.assert_called_once_with(
        'recalculate_asset_position', 2, 9, ingest_share_values=False
    )


async def test_ingestion_triggered_recalculation_does_not_loop(workflow):
    await task.recalculate_position_asset.run.__wrapped__(1, 9, ingest_share_values=False)
    assert workflow.events == ['consolidate']
    workflow.selection.get_funds_requiring_share_values.assert_not_awaited()


async def test_non_funds_do_not_call_the_regulator(workflow):
    workflow.selection.get_funds_requiring_share_values.return_value.since = {}
    await task.recalculate_position_asset.run.__wrapped__(1, 9)
    assert workflow.events == ['consolidate']


async def test_failed_ingestion_does_not_consolidate_or_report_success(workflow):
    workflow.outcome.succeeded.clear()
    workflow.outcome.errors = {9: 'Confirm the fund series'}
    with pytest.raises(BusinessRuleError, match='Confirm the fund series'):
        await task.recalculate_position_asset.run.__wrapped__(1, 9)
    assert workflow.events == ['ingest']
    workflow.returns.assert_not_called()
    workflow.positions.invalidate_patrimony_evolution.assert_not_awaited()


async def test_consolidation_exception_reaches_celery(workflow):
    workflow.consolidator.recalculate_position_asset.side_effect = RuntimeError('No quotes')
    with pytest.raises(RuntimeError, match='No quotes'):
        await task.recalculate_position_asset.run.__wrapped__(1, 9)
    workflow.returns.assert_not_called()
    workflow.positions.invalidate_patrimony_evolution.assert_not_awaited()
