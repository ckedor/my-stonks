"""The operations dashboard: what runs when, how it last went, what is next.

Everything shown is read, nothing is kept: the times come from the scheduler's
entries, the outcomes from the run record and, for an ingestion, from its own
execution while that still exists.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.operations.domain.routines import (
    ROUTINE_BY_TASK,
    ROUTINES,
    ROUTINES_BY_KEY,
    ManualStart,
    Routine,
    RoutineKey,
)
from app.modules.operations.domain.schedule import (
    CronSpec,
    Frequency,
    describe,
    next_runs,
    previous_run,
)
from app.modules.operations.domain.task_run import TaskRun, TaskRunStatus

#: A scheduled run is missed when nothing started within this of its time: the
#: worker picks a due task up in seconds, so ten minutes is not a queue.
MISSED_TOLERANCE = timedelta(minutes=10)
UPCOMING_WINDOW = timedelta(hours=24)
UPCOMING_LIMIT = 20
RECENT_LIMIT = 20

#: Most frequent first, so a routine with two entries shows its busiest.
FREQUENCY_ORDER = (
    Frequency.INTRADAY,
    Frequency.DAILY,
    Frequency.WEEKLY,
    Frequency.MONTHLY,
    Frequency.OTHER,
)


class Health:
    OK = 'ok'
    #: Ran, and part of it failed: an ingestion with some items failed.
    WARNING = 'warning'
    FAILING = 'failing'
    RUNNING = 'running'
    #: Its last scheduled time passed and nothing started.
    MISSED = 'missed'
    NEVER = 'never'
    ON_DEMAND = 'on_demand'


@dataclass(frozen=True)
class ScheduleEntry:
    """One entry of the scheduler, translated at the edge."""

    name: str
    task: str
    spec: CronSpec


@dataclass
class RoutineView:
    routine: Routine
    schedules: list[dict] = field(default_factory=list)
    frequency: str = 'on_demand'
    next_run_at: datetime | None = None
    last_run: dict | None = None
    health: str = Health.NEVER


def _duration(run: TaskRun) -> float | None:
    if run.started_at is None or run.finished_at is None:
        return None
    return (run.finished_at - run.started_at).total_seconds()


def run_view(run: TaskRun) -> dict:
    routine = ROUTINE_BY_TASK.get(run.task_name)
    return {
        'id': run.id,
        'task_name': run.task_name,
        'routine_key': routine.key if routine else None,
        'routine_name': routine.name if routine else None,
        'trigger': run.trigger,
        'status': run.status,
        'started_at': run.started_at,
        'finished_at': run.finished_at,
        'duration_seconds': _duration(run),
        'arguments': run.arguments,
        'result': run.result,
        'error': run.error,
    }


class OperationsReadService:
    def __init__(
        self,
        *,
        uow: UnitOfWork,
        schedule: list[ScheduleEntry],
        zone: ZoneInfo,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.uow = uow
        self.schedule = schedule
        self.zone = zone
        self.clock = clock

    def _entries_of(self, routine: Routine) -> list[ScheduleEntry]:
        return [entry for entry in self.schedule if entry.name in routine.schedule_entries]

    def manual_tasks(self, key: str) -> list[str]:
        """What a person's "run now" sends: exactly what the schedule sends."""
        routine = ROUTINES_BY_KEY.get(key)
        if routine is None:
            raise NotFoundError('Routine not found', context={'routine': key})
        if routine.manual != ManualStart.TASK:
            raise ValidationError(
                'This routine is started from its own screen', context={'routine': key}
            )
        tasks = [entry.task for entry in self._entries_of(routine)]
        return list(dict.fromkeys(tasks)) or ([routine.entry_task] if routine.entry_task else [])

    async def dashboard(self) -> dict:
        now = self.clock()
        views = [self._schedule_view(routine, now) for routine in ROUTINES]
        entry_tasks = [task for routine in ROUTINES for task in routine.tasks]

        async with self.uow as uow:
            started = await uow.task_runs.latest_started(entry_tasks)
            latest_any = await uow.task_runs.latest_by_task(entry_tasks)
            last_runs = {
                view.routine.key: self._last_run(view.routine, started, latest_any)
                for view in views
            }
            children = await uow.task_runs.children_by_status([
                run.celery_task_id for run in last_runs.values() if run and run.celery_task_id
            ])
            executions = {}
            for view in views:
                if view.routine.ingestion_type:
                    found = await uow.ingestions.list_executions(
                        ingestion_type=DataIngestionType(view.routine.ingestion_type), limit=1
                    )
                    executions[view.routine.key] = found[0] if found else None
            since_day = await uow.task_runs.count_by_status_since(now - timedelta(days=1))
            since_week = await uow.task_runs.count_by_status_since(now - timedelta(days=7))
            recent = await uow.task_runs.recent(limit=RECENT_LIMIT, include_chained=False)

        for view in views:
            run = last_runs[view.routine.key]
            execution = executions.get(view.routine.key)
            view.last_run = self._last_run_view(run, children, execution)
            view.health = self._health(view, run, execution, now)

        upcoming = sorted(
            (
                {
                    'routine_key': view.routine.key,
                    'routine_name': view.routine.name,
                    'at': moment,
                    'schedule': schedule['description'],
                }
                for view in views
                for schedule in view.schedules
                for moment in schedule['next_runs']
                if moment - now <= UPCOMING_WINDOW
            ),
            key=lambda item: item['at'],
        )[:UPCOMING_LIMIT]

        return {
            'generated_at': now,
            'timezone': str(self.zone),
            'summary': {
                'routines': len(views),
                'scheduled_routines': sum(1 for view in views if view.schedules),
                'running': sum(1 for view in views if view.health == Health.RUNNING),
                'attention': sum(
                    1
                    for view in views
                    if view.health in (Health.FAILING, Health.WARNING, Health.MISSED)
                ),
                'runs_last_day': sum(since_day.values()),
                'failures_last_day': since_day.get(TaskRunStatus.FAILURE.value, 0),
                'failures_last_week': since_week.get(TaskRunStatus.FAILURE.value, 0),
                'next_run_at': upcoming[0]['at'] if upcoming else None,
            },
            'routines': [
                {
                    'key': view.routine.key,
                    'name': view.routine.name,
                    'group': view.routine.group,
                    'description': view.routine.description,
                    'manual': view.routine.manual,
                    'ingestion_type': view.routine.ingestion_type,
                    'tasks': list(view.routine.tasks),
                    'schedules': view.schedules,
                    'frequency': view.frequency,
                    'next_run_at': view.next_run_at,
                    'last_run': view.last_run,
                    'health': view.health,
                }
                for view in views
            ],
            'upcoming': upcoming,
            'recent_runs': [run_view(run) for run in recent],
        }

    async def runs(
        self,
        *,
        routine: RoutineKey | None,
        status: str | None,
        include_chained: bool,
        limit: int,
    ) -> list[dict]:
        task_names = list(ROUTINES_BY_KEY[routine].tasks) if routine else None
        async with self.uow as uow:
            found = await uow.task_runs.recent(
                limit=limit,
                task_names=task_names,
                status=status,
                include_chained=include_chained,
            )
        return [run_view(run) for run in found]

    # --- pieces --------------------------------------------------------------

    def _schedule_view(self, routine: Routine, now: datetime) -> RoutineView:
        view = RoutineView(routine=routine)
        for entry in self._entries_of(routine):
            upcoming = next_runs(entry.spec, after=now, zone=self.zone)
            view.schedules.append({
                'entry': entry.name,
                'task': entry.task,
                'description': describe(entry.spec),
                'frequency': entry.spec.frequency,
                'next_runs': upcoming,
                'previous_run_at': previous_run(entry.spec, before=now, zone=self.zone),
            })
        if view.schedules:
            view.frequency = min(
                (schedule['frequency'] for schedule in view.schedules),
                key=FREQUENCY_ORDER.index,
            )
            nexts = [
                schedule['next_runs'][0] for schedule in view.schedules if schedule['next_runs']
            ]
            view.next_run_at = min(nexts) if nexts else None
        return view

    @staticmethod
    def _last_run(routine: Routine, started: dict, latest_any: dict) -> TaskRun | None:
        """The last run a schedule or a person started; a chained one if that is all."""
        own = [started[task] for task in routine.tasks if task in started]
        if own:
            return max(own, key=lambda run: run.started_at)
        chained = [latest_any[task] for task in routine.tasks if task in latest_any]
        return max(chained, key=lambda run: run.started_at) if chained else None

    @staticmethod
    def _last_run_view(run: TaskRun | None, children: dict, execution) -> dict | None:
        if run is None and execution is None:
            return None
        view = run_view(run) if run else {}
        view['children'] = (
            children.get(run.celery_task_id, {}) if run and run.celery_task_id else {}
        )
        view['execution'] = (
            {
                'id': execution.id,
                'status': execution.status,
                'trigger': execution.trigger,
                'requested_at': execution.requested_at,
                'finished_at': execution.finished_at,
                'total_items': execution.total_items,
                'succeeded_items': execution.succeeded_items,
                'failed_items': execution.failed_items,
                'error': execution.error,
            }
            if execution is not None
            else None
        )
        return view

    def _health(self, view: RoutineView, run: TaskRun | None, execution, now: datetime) -> str:
        if run is None and execution is None:
            return Health.NEVER if view.schedules else Health.ON_DEMAND
        if run is not None and run.status == TaskRunStatus.RUNNING:
            return Health.RUNNING
        if execution is not None and execution.status in ('queued', 'running'):
            return Health.RUNNING
        if view.schedules and run is not None:
            due = [s['previous_run_at'] for s in view.schedules if s['previous_run_at']]
            if due and run.started_at < max(due) - MISSED_TOLERANCE:
                return Health.MISSED
        if run is not None and run.status == TaskRunStatus.FAILURE:
            return Health.FAILING
        if execution is not None and execution.status == 'failure':
            return Health.FAILING
        if execution is not None and execution.status == 'partial_success':
            return Health.WARNING
        children = view.last_run.get('children') if view.last_run else None
        if children and children.get(TaskRunStatus.FAILURE.value):
            return Health.WARNING
        return Health.OK
