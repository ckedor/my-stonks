"""Composition root for the operations module.

The scheduler's entries are translated here, at the edge, into the plain
schedule the domain reads: the operations module never imports the worker.
"""

from zoneinfo import ZoneInfo

from fastapi import Depends

from app.entrypoints.worker.scheduler import WORKER_TIMEZONE, beat_schedule
from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.modules.operations.domain.schedule import CronSpec
from app.modules.operations.service.operations_read_service import (
    OperationsReadService,
    ScheduleEntry,
)
from app.modules.operations.service.task_run_service import TaskRunService


def schedule_entries() -> list[ScheduleEntry]:
    return [
        ScheduleEntry(
            name=name,
            task=entry['task'],
            spec=CronSpec(
                minutes=frozenset(entry['schedule'].minute),
                hours=frozenset(entry['schedule'].hour),
                days_of_week=frozenset(entry['schedule'].day_of_week),
                days_of_month=frozenset(entry['schedule'].day_of_month),
                months=frozenset(entry['schedule'].month_of_year),
            ),
        )
        for name, entry in beat_schedule.items()
    ]


def get_operations_read_service(uow: UnitOfWork = Depends(get_uow)) -> OperationsReadService:
    return OperationsReadService(
        uow=uow, schedule=schedule_entries(), zone=ZoneInfo(WORKER_TIMEZONE)
    )


def build_task_run_service() -> TaskRunService:
    """One per call: a run is opened and closed by two separate writes."""
    return TaskRunService(UnitOfWork())
