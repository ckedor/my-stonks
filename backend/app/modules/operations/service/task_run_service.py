"""Writing the run record, and keeping it to a useful length."""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.operations.domain.task_run import (
    TASK_RUN_LOST_AFTER_HOURS,
    TaskRun,
    TaskRunStatus,
)

#: Long enough to see the last run of a monthly routine, and the one before.
TASK_RUN_RETENTION = timedelta(days=45)

#: A value longer than this is cut: the record says which run it was, it does
#: not keep the payload.
MAX_TEXT = 200
MAX_ITEMS = 20
MAX_ERROR = 4000
#: Two levels say what a run was about; deeper is payload.
MAX_DEPTH = 2


def summarize(value: Any, *, depth: int = 0) -> Any:
    """A JSON-safe, screen-sized version of an argument or a return value."""
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, str):
        return value if len(value) <= MAX_TEXT else f'{value[:MAX_TEXT]}…'
    if depth >= MAX_DEPTH:
        return f'<{type(value).__name__}>'
    if isinstance(value, dict):
        items = list(value.items())
        summary = {str(key): summarize(item, depth=depth + 1) for key, item in items[:MAX_ITEMS]}
        if len(items) > MAX_ITEMS:
            summary['…'] = f'+{len(items) - MAX_ITEMS}'
        return summary
    if isinstance(value, list | tuple | set):
        items = list(value)
        summary = [summarize(item, depth=depth + 1) for item in items[:MAX_ITEMS]]
        if len(items) > MAX_ITEMS:
            summary.append(f'+{len(items) - MAX_ITEMS}')
        return summary
    return str(value)[:MAX_TEXT]


class TaskRunService:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def start(  # noqa: PLR0913 - one field each
        self,
        *,
        task_name: str,
        celery_task_id: str | None,
        parent_task_id: str | None,
        trigger: str,
        args: tuple,
        kwargs: dict,
    ) -> int:
        async with self.uow as uow:
            run_id = await uow.task_runs.add(
                TaskRun(
                    task_name=task_name,
                    celery_task_id=celery_task_id,
                    parent_task_id=parent_task_id,
                    trigger=trigger,
                    status=TaskRunStatus.RUNNING,
                    arguments={'args': summarize(list(args)), 'kwargs': summarize(kwargs)},
                    started_at=datetime.now(UTC),
                )
            )
            await uow.commit()
        return run_id

    async def finish(self, run_id: int, *, result: Any = None, error: str | None = None) -> None:
        async with self.uow as uow:
            await uow.task_runs.close(
                run_id,
                status=(TaskRunStatus.FAILURE if error else TaskRunStatus.SUCCESS).value,
                result=summarize(result),
                error=error[:MAX_ERROR] if error else None,
                finished_at=datetime.now(UTC),
            )
            await uow.commit()

    async def maintain_history(self, *, now: datetime | None = None) -> dict:
        now = now or datetime.now(UTC)
        async with self.uow as uow:
            lost = await uow.task_runs.close_lost(
                started_before=now - timedelta(hours=TASK_RUN_LOST_AFTER_HOURS), now=now
            )
            deleted = await uow.task_runs.delete_started_before(now - TASK_RUN_RETENTION)
            await uow.commit()
        return {'closed_as_lost': lost, 'deleted': deleted}
