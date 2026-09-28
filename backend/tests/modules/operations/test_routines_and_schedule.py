"""The routine catalog is whole, and the schedule reads the way it runs.

The catalog is what the admin's operations screen lists, so a scheduler entry
or a task left out of it is a job running where nobody looks. These tests are
the guard: they fail the build instead.
"""

import importlib
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.composition.operations import schedule_entries
from app.entrypoints.worker.celery_app import celery_app
from app.entrypoints.worker.scheduler import WORKER_TIMEZONE, beat_schedule
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.operations.domain.routines import ROUTINES, ManualStart
from app.modules.operations.domain.schedule import (
    ALL_DAYS_OF_MONTH,
    ALL_DAYS_OF_WEEK,
    ALL_HOURS,
    ALL_MINUTES,
    ALL_MONTHS,
    CronSpec,
    Frequency,
    describe,
    next_runs,
    previous_run,
)

pytestmark = pytest.mark.unit

ZONE = ZoneInfo(WORKER_TIMEZONE)


def _registered_tasks() -> set[str]:
    for module in celery_app.conf.imports:
        importlib.import_module(module)
    return {name for name in celery_app.tasks if not name.startswith('celery.')}


# --- the catalog is whole -----------------------------------------------------


def misplaced(names, owned_by) -> dict:
    """Each name that does not belong to exactly one routine, with its owners."""
    owners = {
        name: [routine.key for routine in ROUTINES if name in owned_by(routine)] for name in names
    }
    return {name: keys for name, keys in owners.items() if len(keys) != 1}


def test_every_scheduler_entry_belongs_to_exactly_one_routine():
    assert misplaced(beat_schedule, lambda routine: routine.schedule_entries) == {}


def test_every_registered_task_belongs_to_exactly_one_routine():
    registered = _registered_tasks()

    assert misplaced(registered, lambda routine: routine.tasks) == {}
    # And the catalog names no task the worker does not have.
    assert {task for routine in ROUTINES for task in routine.tasks} <= registered


def test_the_guard_fires_on_a_job_nobody_catalogued():
    """A guard that silently stopped matching would be trusted anyway."""
    assert misplaced(['a-new-nightly-job'], lambda routine: routine.schedule_entries) == {
        'a-new-nightly-job': []
    }
    assert misplaced(['consolidate_portfolio'], lambda routine: ('consolidate_portfolio',)) != {}


def test_every_routine_entry_exists_and_starts_one_of_its_tasks():
    for routine in ROUTINES:
        for entry in routine.schedule_entries:
            assert entry in beat_schedule, (routine.key, entry)
            assert beat_schedule[entry]['task'] in routine.tasks, (routine.key, entry)


def test_every_scheduler_message_is_marked_as_scheduled():
    for entry in beat_schedule.values():
        assert entry['options']['headers']['trigger'] == 'scheduled'


def test_a_routine_is_started_the_way_it_can_be():
    for routine in ROUTINES:
        if routine.manual == ManualStart.INGESTION:
            assert DataIngestionType(routine.ingestion_type)
        if routine.manual == ManualStart.TASK:
            assert routine.tasks, routine.key


# --- the schedule reads the way it runs ---------------------------------------


def spec(**fields) -> CronSpec:
    return CronSpec(
        minutes=fields.get('minutes', ALL_MINUTES),
        hours=fields.get('hours', ALL_HOURS),
        days_of_week=fields.get('days_of_week', ALL_DAYS_OF_WEEK),
        days_of_month=fields.get('days_of_month', ALL_DAYS_OF_MONTH),
        months=fields.get('months', ALL_MONTHS),
    )


def test_the_real_entries_are_described_as_they_run():
    entries = {entry.name: entry.spec for entry in schedule_entries()}

    assert describe(entries['ingest-quotes-for-held-assets']) == (
        'Todo dia às 06:15, 12:15 e 18:15'
    )
    assert entries['ingest-quotes-for-held-assets'].frequency == Frequency.INTRADAY
    assert describe(entries['ingest-usd-brl']) == 'Todo dia às 05:00'
    assert describe(entries['ingest-fund-registry']) == 'Toda terça às 09:00'
    assert entries['ingest-fund-registry'].frequency == Frequency.WEEKLY
    assert describe(entries['ingest-etf-registry']) == 'Toda quarta às 09:30'


def test_a_monthly_and_a_weekend_schedule():
    monthly = spec(minutes=frozenset({0}), hours=frozenset({3}), days_of_month=frozenset({1}))
    weekend = spec(minutes=frozenset({0}), hours=frozenset({8}), days_of_week=frozenset({0, 6}))

    assert monthly.frequency == Frequency.MONTHLY
    assert describe(monthly) == 'Todo mês, no dia 1, às 03:00'
    assert describe(weekend) == 'Aos sábados e aos domingos às 08:00'
    weekdays = spec(minutes=frozenset({0}), hours=frozenset({8}), days_of_week=frozenset({2, 6}))
    assert describe(weekdays) == 'Às terças e aos sábados às 08:00'
    assert describe(
        spec(minutes=frozenset({0}), hours=frozenset({8}), days_of_week=frozenset({0}))
    ) == ('Todo domingo às 08:00')


def test_next_and_previous_runs_are_in_the_worker_zone():
    tuesday_nine = spec(minutes=frozenset({0}), hours=frozenset({9}), days_of_week=frozenset({2}))
    # Wednesday 2026-09-23, 15:00 in Brasília.
    now = datetime(2026, 9, 23, 18, 0, tzinfo=ZoneInfo('UTC'))

    upcoming = next_runs(tuesday_nine, after=now, zone=ZONE, count=2)

    assert upcoming == [
        datetime(2026, 9, 29, 9, 0, tzinfo=ZONE),
        datetime(2026, 10, 6, 9, 0, tzinfo=ZONE),
    ]
    assert previous_run(tuesday_nine, before=now, zone=ZONE) == datetime(
        2026, 9, 22, 9, 0, tzinfo=ZONE
    )


def test_a_schedule_that_never_fires_has_no_next_run():
    never = spec(
        minutes=frozenset({0}),
        hours=frozenset({0}),
        days_of_month=frozenset({31}),
        months=frozenset({2}),
    )

    assert next_runs(never, after=datetime(2026, 1, 1, tzinfo=ZONE), zone=ZONE) == []
