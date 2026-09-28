from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, select, update

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.operations.domain.task_run import TaskRun, TaskRunStatus, TaskRunTrigger


class TaskRunRepository(SQLAlchemyRepository):
    async def add(self, run: TaskRun) -> int:
        self.session.add(run)
        await self.session.flush()
        return run.id

    async def close(self, run_id: int, **values) -> None:
        await self.session.execute(update(TaskRun).where(TaskRun.id == run_id).values(**values))

    async def latest_by_task(self, task_names: Sequence[str]) -> dict[str, TaskRun]:
        """The most recent run of each task, including chained ones."""
        if not task_names:
            return {}
        result = await self.session.execute(
            select(TaskRun)
            .where(TaskRun.task_name.in_(task_names))
            .order_by(TaskRun.task_name, TaskRun.started_at.desc())
            .distinct(TaskRun.task_name)
        )
        return {run.task_name: run for run in result.scalars().all()}

    async def latest_started(
        self, task_names: Sequence[str], *, exclude_chained: bool = True
    ) -> dict[str, TaskRun]:
        """The most recent run of each task that a schedule or a person started."""
        if not task_names:
            return {}
        statement = select(TaskRun).where(TaskRun.task_name.in_(task_names))
        if exclude_chained:
            statement = statement.where(TaskRun.trigger != TaskRunTrigger.CHAINED.value)
        result = await self.session.execute(
            statement.order_by(TaskRun.task_name, TaskRun.started_at.desc()).distinct(
                TaskRun.task_name
            )
        )
        return {run.task_name: run for run in result.scalars().all()}

    async def children_by_status(self, parent_task_ids: Sequence[str]) -> dict[str, dict]:
        """How the tasks each run sent ended, counted by status."""
        if not parent_task_ids:
            return {}
        result = await self.session.execute(
            select(TaskRun.parent_task_id, TaskRun.status, func.count())
            .where(TaskRun.parent_task_id.in_(parent_task_ids))
            .group_by(TaskRun.parent_task_id, TaskRun.status)
        )
        counts: dict[str, dict] = {}
        for parent, status, count in result.all():
            counts.setdefault(parent, {})[status] = count
        return counts

    async def recent(
        self,
        *,
        limit: int,
        task_names: Sequence[str] | None = None,
        status: str | None = None,
        include_chained: bool = True,
    ) -> list[TaskRun]:
        statement = select(TaskRun)
        if task_names is not None:
            statement = statement.where(TaskRun.task_name.in_(task_names))
        if status is not None:
            statement = statement.where(TaskRun.status == status)
        if not include_chained:
            statement = statement.where(TaskRun.trigger != TaskRunTrigger.CHAINED.value)
        result = await self.session.execute(
            statement.order_by(TaskRun.started_at.desc(), TaskRun.id.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def count_by_status_since(self, since: datetime) -> dict[str, int]:
        result = await self.session.execute(
            select(TaskRun.status, func.count())
            .where(TaskRun.started_at >= since)
            .group_by(TaskRun.status)
        )
        return dict(result.all())

    async def close_lost(self, *, started_before: datetime, now: datetime) -> int:
        """Runs still open long past any task's length: the worker died under them."""
        result = await self.session.execute(
            update(TaskRun)
            .where(TaskRun.status == TaskRunStatus.RUNNING.value)
            .where(TaskRun.started_at < started_before)
            .values(
                status=TaskRunStatus.FAILURE.value,
                finished_at=now,
                error='A tarefa não terminou: o worker parou durante a execução',
            )
        )
        return result.rowcount or 0

    async def delete_started_before(self, before: datetime) -> int:
        result = await self.session.execute(delete(TaskRun).where(TaskRun.started_at < before))
        return result.rowcount or 0
