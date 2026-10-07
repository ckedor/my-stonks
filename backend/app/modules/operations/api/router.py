from fastapi import APIRouter, Depends, Query

from app.composition.operations import get_operations_read_service, get_storage_read_service
from app.core.exceptions import TaskDispatchError
from app.entrypoints.worker.task_runner import run_task_by_name
from app.modules.operations.api.schemas import (
    DatabaseStorageResponse,
    DispatchedTaskResponse,
    OperationsDashboardResponse,
    RoutineRunResponse,
    TableStorageResponse,
    TaskRunResponse,
)
from app.modules.operations.domain.routines import RoutineKey
from app.modules.operations.domain.task_run import TaskRunStatus
from app.modules.operations.service.operations_read_service import OperationsReadService
from app.modules.operations.service.storage_read_service import StorageReadService
from app.modules.users.views import current_superuser

router = APIRouter(
    prefix='/operations',
    tags=['Operations'],
    dependencies=[Depends(current_superuser)],
)


@router.get('/dashboard', response_model=OperationsDashboardResponse)
async def get_operations_dashboard(
    service: OperationsReadService = Depends(get_operations_read_service),
):
    return await service.dashboard()


@router.get('/runs', response_model=list[TaskRunResponse])
async def list_task_runs(
    routine: RoutineKey | None = None,
    status: TaskRunStatus | None = None,
    include_chained: bool = True,
    limit: int = Query(default=100, ge=1, le=500),
    service: OperationsReadService = Depends(get_operations_read_service),
):
    return await service.runs(
        routine=routine,
        status=status.value if status else None,
        include_chained=include_chained,
        limit=limit,
    )


@router.post('/routines/{routine}/run', response_model=RoutineRunResponse)
async def run_routine(
    routine: RoutineKey,
    service: OperationsReadService = Depends(get_operations_read_service),
):
    """Send what the schedule sends for this routine, now.

    Only for routines started by a task. An ingestion is started through its
    own route, which opens its execution first; a routine that shows a diff
    before writing is started on its own screen.
    """
    task_names = service.manual_tasks(routine)
    dispatched = []
    try:
        for task_name in task_names:
            task = run_task_by_name(task_name)
            dispatched.append(DispatchedTaskResponse(task=task_name, task_id=task.id))
    except Exception as exc:
        raise TaskDispatchError from exc
    return RoutineRunResponse(routine=routine, dispatched=dispatched)


@router.get('/storage', response_model=DatabaseStorageResponse)
async def get_database_storage(
    service: StorageReadService = Depends(get_storage_read_service),
):
    """How much room the database takes, table by table, largest first."""
    storage = await service.database_storage()
    return DatabaseStorageResponse(
        database_bytes=storage.database_bytes,
        tables=[
            TableStorageResponse(
                schema_name=table.schema,
                name=table.name,
                rows=table.rows,
                table_bytes=table.table_bytes,
                index_bytes=table.index_bytes,
                total_bytes=table.total_bytes,
            )
            for table in storage.tables
        ],
    )
