from sqlalchemy import inspect

from app.infra.db.base import Base
from app.infra.db.tables.operations import task_run_table
from app.modules.operations.domain.task_run import TaskRun


def map_operations() -> None:
    if inspect(TaskRun, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(TaskRun, task_run_table)
