"""The run record and the operations dashboard, against Postgres.

The record is written by the task runner around the task, so the proof goes
through the runner's own wrapper: a task that succeeds, one that raises, and
one sent by another task each leave the row the dashboard later reads.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.composition.operations import schedule_entries
from app.core.exceptions import ValidationError
from app.entrypoints.worker.scheduler import WORKER_TIMEZONE
from app.entrypoints.worker.task_runner import _recorded
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.operations.domain.task_run import TaskRun
from app.modules.operations.service.bucket_read_service import BucketReadService
from app.modules.operations.service.operations_read_service import OperationsReadService
from app.modules.operations.service.storage_read_service import StorageReadService
from app.modules.operations.service.task_run_service import TaskRunService
from tests.fakes import InMemoryDocumentStorage

# Wednesday 2026-09-23, 12:50 in Brasília: the 12:30 consolidation is due.
NOW = datetime(2026, 9, 23, 15, 50, tzinfo=UTC)


def request(task_id, *, parent=None, trigger=None):
    return SimpleNamespace(id=task_id, parent_id=parent, trigger=trigger)


def dashboard_service(now=NOW) -> OperationsReadService:
    return OperationsReadService(
        uow=UnitOfWork(),
        schedule=schedule_entries(),
        zone=ZoneInfo(WORKER_TIMEZONE),
        clock=lambda: now,
    )


async def runs_of(db, task_name):
    result = await db.execute(
        select(TaskRun).where(TaskRun.task_name == task_name).order_by(TaskRun.id)
    )
    return list(result.scalars().all())


async def test_the_runner_records_how_each_task_ended_and_who_sent_it(db):
    async def consolidate_all():
        return {'portfolios': 2}

    async def consolidate_one(portfolio_id):
        if portfolio_id == 2:
            raise RuntimeError('provider has no quote for XPTO11')
        return portfolio_id

    await _recorded(
        'consolidate_all_portfolios',
        request('parent-1', trigger='scheduled'),
        consolidate_all,
        (),
        {},
    )
    await _recorded(
        'consolidate_portfolio', request('child-1', parent='parent-1'), consolidate_one, (1,), {}
    )
    with pytest.raises(RuntimeError):
        await _recorded(
            'consolidate_portfolio',
            request('child-2', parent='parent-1'),
            consolidate_one,
            (2,),
            {},
        )

    (parent,) = await runs_of(db, 'consolidate_all_portfolios')
    assert (parent.trigger, parent.status, parent.result) == (
        'scheduled',
        'success',
        {'portfolios': 2},
    )
    children = await runs_of(db, 'consolidate_portfolio')
    assert [(run.trigger, run.status) for run in children] == [
        ('chained', 'success'),
        ('chained', 'failure'),
    ]
    assert children[1].error == 'RuntimeError: provider has no quote for XPTO11'
    assert children[0].arguments == {'args': [1], 'kwargs': {}}


async def test_the_dashboard_reads_schedule_last_run_and_what_it_sent(db):
    started = NOW - timedelta(minutes=20)  # 12:30 in Brasília, on time
    db.add_all([
        TaskRun(
            task_name='consolidate_all_portfolios',
            celery_task_id='parent-1',
            trigger='scheduled',
            status='success',
            arguments={},
            started_at=started,
            finished_at=started + timedelta(seconds=2),
        ),
        TaskRun(
            task_name='consolidate_portfolio',
            celery_task_id='child-1',
            parent_task_id='parent-1',
            trigger='chained',
            status='success',
            arguments={},
            started_at=started,
        ),
        TaskRun(
            task_name='consolidate_portfolio',
            celery_task_id='child-2',
            parent_task_id='parent-1',
            trigger='chained',
            status='failure',
            arguments={},
            started_at=started,
        ),
        # The dividend sweep last ran two days ago: today's 04:30 was missed.
        TaskRun(
            task_name='consolidate_fiis_dividends',
            trigger='scheduled',
            status='success',
            arguments={},
            started_at=NOW - timedelta(days=2),
        ),
    ])
    await db.flush()

    dashboard = await dashboard_service().dashboard()

    routines = {routine['key']: routine for routine in dashboard['routines']}
    consolidation = routines['portfolio_consolidation']
    assert consolidation['frequency'] == 'intraday'
    assert consolidation['schedules'][0]['description'] == 'Todo dia às 06:30, 12:30 e 18:30'
    assert consolidation['last_run']['children'] == {'success': 1, 'failure': 1}
    # It ran, and one portfolio of two failed.
    assert consolidation['health'] == 'warning'
    assert routines['fii_dividends']['health'] == 'missed'
    assert routines['asset_catalogue']['health'] == 'on_demand'
    assert routines['asset_catalogue']['schedules'] == []
    # The next run anywhere is the 13:00 series ingestion.
    assert dashboard['summary']['next_run_at'] == datetime(
        2026, 9, 23, 13, 0, tzinfo=ZoneInfo(WORKER_TIMEZONE)
    )
    assert dashboard['summary']['failures_last_day'] == 1
    # Chained runs are counted, but the feed lists what was started.
    assert [run['task_name'] for run in dashboard['recent_runs']][:1] == [
        'consolidate_all_portfolios'
    ]


async def test_run_now_sends_what_the_schedule_sends_and_nothing_else():
    service = dashboard_service()

    assert service.manual_tasks('execution_history') == [
        'maintain_data_ingestion_history',
        'maintain_task_run_history',
    ]
    assert service.manual_tasks('portfolio_consolidation') == ['consolidate_all_portfolios']
    with pytest.raises(ValidationError):
        # An ingestion opens its execution through its own route first.
        service.manual_tasks('quotes')


async def test_history_closes_lost_runs_and_drops_old_ones(db):
    now = datetime.now(UTC)
    db.add_all([
        TaskRun(
            task_name='ingest_usd_brl',
            trigger='scheduled',
            status='running',
            arguments={},
            started_at=now - timedelta(hours=7),
        ),
        TaskRun(
            task_name='ingest_usd_brl',
            trigger='scheduled',
            status='success',
            arguments={},
            started_at=now - timedelta(days=46),
        ),
    ])
    await db.flush()

    report = await TaskRunService(UnitOfWork()).maintain_history(now=now)

    assert report == {'closed_as_lost': 1, 'deleted': 1}
    (lost,) = await runs_of(db, 'ingest_usd_brl')
    await db.refresh(lost)
    assert lost.status == 'failure'


async def test_the_storage_lists_every_table_with_its_indexes_largest_first(db):
    storage = await StorageReadService(UnitOfWork()).database_storage()

    names = {(table.schema, table.name) for table in storage.tables}
    assert ('operations', 'task_run') in names
    sizes = [table.total_bytes for table in storage.tables]
    assert sizes == sorted(sizes, reverse=True)
    task_run = next(t for t in storage.tables if t.name == 'task_run')
    assert task_run.table_bytes > 0
    assert task_run.index_bytes > 0
    assert storage.database_bytes >= sum(sizes)


async def test_the_bucket_reads_as_not_configured_when_the_deploy_has_none():
    assert await BucketReadService(storage=None).usage() is None


async def test_the_bucket_usage_is_what_the_storage_reports():
    storage = InMemoryDocumentStorage()
    await storage.put('portfolio/1/a.pdf', b'12345', content_type='application/pdf')

    usage = await BucketReadService(storage=storage).usage()

    assert (usage.objects, usage.bytes) == (1, 5)
