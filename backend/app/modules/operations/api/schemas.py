from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.modules.operations.domain.routines import ManualStart, RoutineGroup, RoutineKey
from app.modules.operations.domain.schedule import Frequency
from app.modules.operations.domain.task_run import TaskRunStatus, TaskRunTrigger

RoutineHealth = Literal['ok', 'warning', 'failing', 'running', 'missed', 'never', 'on_demand']


class TaskRunResponse(BaseModel):
    id: int
    task_name: str
    routine_key: RoutineKey | None
    routine_name: str | None
    trigger: TaskRunTrigger
    status: TaskRunStatus
    started_at: datetime
    finished_at: datetime | None
    duration_seconds: float | None
    arguments: dict[str, Any]
    result: Any = None
    error: str | None


class IngestionExecutionSummary(BaseModel):
    id: int
    status: str
    trigger: str
    requested_at: datetime | None
    finished_at: datetime | None
    total_items: int
    succeeded_items: int
    failed_items: int
    error: str | None


class LastRunResponse(BaseModel):
    """The last run of a routine: its task run, what it sent, its execution."""

    id: int | None = None
    task_name: str | None = None
    trigger: TaskRunTrigger | None = None
    status: TaskRunStatus | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = None
    error: str | None = None
    #: How the tasks it sent ended, by status: the consolidation of each portfolio.
    children: dict[str, int]
    execution: IngestionExecutionSummary | None


class RoutineScheduleResponse(BaseModel):
    entry: str
    task: str
    description: str
    frequency: Frequency
    next_runs: list[datetime]
    previous_run_at: datetime | None


class RoutineResponse(BaseModel):
    key: RoutineKey
    name: str
    group: RoutineGroup
    description: str
    manual: ManualStart
    ingestion_type: str | None
    tasks: list[str]
    schedules: list[RoutineScheduleResponse]
    frequency: Frequency | Literal['on_demand']
    next_run_at: datetime | None
    last_run: LastRunResponse | None
    health: RoutineHealth


class UpcomingRunResponse(BaseModel):
    routine_key: RoutineKey
    routine_name: str
    at: datetime
    schedule: str


class OperationsSummaryResponse(BaseModel):
    routines: int
    scheduled_routines: int
    running: int
    attention: int
    runs_last_day: int
    failures_last_day: int
    failures_last_week: int
    next_run_at: datetime | None


class OperationsDashboardResponse(BaseModel):
    generated_at: datetime
    timezone: str
    summary: OperationsSummaryResponse
    routines: list[RoutineResponse]
    upcoming: list[UpcomingRunResponse]
    recent_runs: list[TaskRunResponse]


class DispatchedTaskResponse(BaseModel):
    task: str
    task_id: str


class RoutineRunResponse(BaseModel):
    routine: RoutineKey
    dispatched: list[DispatchedTaskResponse]


class TableStorageResponse(BaseModel):
    schema_name: str
    name: str
    rows: int
    table_bytes: int
    index_bytes: int
    total_bytes: int


class DatabaseStorageResponse(BaseModel):
    database_bytes: int
    tables: list[TableStorageResponse]


class PrefixUsageResponse(BaseModel):
    prefix: str
    objects: int
    bytes: int
    last_modified: datetime | None


class BucketUsageResponse(BaseModel):
    #: False when the deploy has no bucket; the rest is then empty.
    configured: bool
    bucket: str | None = None
    objects: int = 0
    bytes: int = 0
    truncated: bool = False
    prefixes: list[PrefixUsageResponse] = []
