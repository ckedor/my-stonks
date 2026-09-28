"""One run of a worker task, as the worker itself recorded it.

The record is written by the task runner around every task, not by the task:
a routine that forgot to record itself would be the one nobody noticed had
stopped. So every task has runs, whether or not it tracks anything of its own —
the consolidation, the dividend sweep and the history cleanup had nothing but
a log line before this.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class TaskRunTrigger(StrEnum):
    #: Sent by the scheduler.
    SCHEDULED = 'scheduled'
    #: Sent by a person, from a screen.
    MANUAL = 'manual'
    #: Sent by another task: a consolidation per portfolio, the quote ingestion
    #: the held-assets selection chains into.
    CHAINED = 'chained'


class TaskRunStatus(StrEnum):
    RUNNING = 'running'
    SUCCESS = 'success'
    FAILURE = 'failure'


#: A run is written when it starts and closed when it ends. One the worker died
#: under never ends, so past this it is read as lost rather than as running.
TASK_RUN_LOST_AFTER_HOURS = 6


@dataclass(eq=False, kw_only=True)
class TaskRun:
    id: int | None = None
    task_name: str
    celery_task_id: str | None = None
    #: The run that sent this one, when a task sent it.
    parent_task_id: str | None = None
    trigger: str
    status: str = TaskRunStatus.RUNNING
    #: What it was called with and what it returned, trimmed to what fits a
    #: screen: enough to tell two runs apart, not a copy of the payload.
    arguments: dict[str, Any] = field(default_factory=dict)
    result: Any = None
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
