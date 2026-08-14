from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_data_ingestion_read_service,
    get_data_ingestion_service,
)
from app.core.exceptions import TaskDispatchError
from app.entrypoints.worker.task_runner import revoke_task, run_task_by_name
from app.modules.market_data.api.ingestion.schemas import (
    DataIngestionExecutionDetailResponse,
    DataIngestionExecutionResponse,
    RunDataIngestionRequest,
    RunMarketDataSeriesIngestionRequest,
    RunUsdBrlIngestionRequest,
)
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.users.domain import User
from app.modules.users.views import current_superuser

#: Every task is dispatched by name, so this router never imports one.
#:
#: A task pulls in its service, its adapters and its provider, and importing one
#: here would load all of that into the HTTP process at boot — an import error
#: inside a worker task would take the API down with it, on a route nobody
#: called. The names match the `@celery_async_task(name=...)` registrations.
#:
#: The first is owned by the portfolio module, which is where this pattern
#: started. See portfolio.tasks.ingest_quotes_for_held_assets.
INGEST_QUOTES_FOR_HELD_ASSETS_TASK = 'ingest_quotes_for_held_assets'
INGEST_QUOTES_TASK = 'ingest_quotes'
INGEST_MARKET_DATA_SERIES_TASK = 'ingest_market_data_series'
INGEST_USD_BRL_TASK = 'ingest_usd_brl'

router = APIRouter(
    prefix='/ingestions',
    tags=['Data Ingestion'],
    dependencies=[Depends(current_superuser)],
)


def _revoke_pending_task(execution) -> None:
    """Keep an aborted execution's task from starting after the fact.

    Only useful while the message is still queued; a task already running stops
    on its own when its runner reads the aborted execution.
    """
    if execution.task_id:
        revoke_task(execution.task_id)


@router.get('/quote', response_model=list[DataIngestionExecutionResponse])
async def list_quote_ingestions(
    limit: int = Query(default=50, ge=1, le=200),
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.list_quote_executions(limit=limit)


@router.get(
    '/quote/{execution_id}',
    response_model=DataIngestionExecutionDetailResponse,
)
async def get_quote_ingestion(
    execution_id: int,
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.get_quote_execution(execution_id)


@router.post('/quote', response_model=DataIngestionExecutionResponse)
async def run_quote_ingestion(
    payload: RunDataIngestionRequest,
    user: User = Depends(current_superuser),
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.request_quote_execution(
        requested_by_user_id=user.id,
        item_ids=payload.item_ids,
        force_full_history=payload.force_full_history,
    )
    try:
        if payload.item_ids:
            # The assets are already chosen: no selection step needed.
            task = run_task_by_name(
                INGEST_QUOTES_TASK,
                asset_ids=payload.item_ids,
                execution_id=execution.id,
                force_full_history=payload.force_full_history,
            )
        else:
            task = run_task_by_name(
                INGEST_QUOTES_FOR_HELD_ASSETS_TASK,
                execution.id,
                payload.force_full_history,
            )
        return await service.set_task_id(execution.id, task.id)
    except Exception as exc:
        await service.fail(execution.id, exc)
        raise TaskDispatchError from exc


@router.post('/quote/{execution_id}/abort', response_model=DataIngestionExecutionResponse)
async def abort_quote_ingestion(
    execution_id: int,
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.abort_quote_execution(execution_id)
    _revoke_pending_task(execution)
    return execution


@router.get(
    '/market_data_series',
    response_model=list[DataIngestionExecutionResponse],
)
async def list_market_data_series_ingestions(
    limit: int = Query(default=50, ge=1, le=200),
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.list_series_executions(limit=limit)


@router.get(
    '/market_data_series/{execution_id}',
    response_model=DataIngestionExecutionDetailResponse,
)
async def get_market_data_series_ingestion(
    execution_id: int,
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.get_series_execution(execution_id)


@router.post('/market_data_series', response_model=DataIngestionExecutionResponse)
async def run_market_data_series_ingestion(
    payload: RunMarketDataSeriesIngestionRequest,
    user: User = Depends(current_superuser),
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.request_series_execution(
        requested_by_user_id=user.id,
        force_full_history=payload.force_full_history,
    )
    try:
        task = run_task_by_name(
            INGEST_MARKET_DATA_SERIES_TASK,
            execution.id,
            payload.force_full_history,
        )
        return await service.set_task_id(execution.id, task.id)
    except Exception as exc:
        await service.fail(execution.id, exc)
        raise TaskDispatchError from exc


@router.post(
    '/market_data_series/{execution_id}/abort',
    response_model=DataIngestionExecutionResponse,
)
async def abort_market_data_series_ingestion(
    execution_id: int,
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.abort_series_execution(execution_id)
    _revoke_pending_task(execution)
    return execution


@router.get('/usd_brl', response_model=list[DataIngestionExecutionResponse])
async def list_usd_brl_ingestions(
    limit: int = Query(default=50, ge=1, le=200),
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.list_usd_brl_executions(limit=limit)


@router.get(
    '/usd_brl/{execution_id}',
    response_model=DataIngestionExecutionDetailResponse,
)
async def get_usd_brl_ingestion(
    execution_id: int,
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.get_usd_brl_execution(execution_id)


@router.post('/usd_brl', response_model=DataIngestionExecutionResponse)
async def run_usd_brl_ingestion(
    payload: RunUsdBrlIngestionRequest,
    user: User = Depends(current_superuser),
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.request_usd_brl_execution(
        requested_by_user_id=user.id,
        force_full_history=payload.force_full_history,
    )
    try:
        task = run_task_by_name(
            INGEST_USD_BRL_TASK,
            execution.id,
            payload.force_full_history,
        )
        return await service.set_task_id(execution.id, task.id)
    except Exception as exc:
        await service.fail(execution.id, exc)
        raise TaskDispatchError from exc


@router.post('/usd_brl/{execution_id}/abort', response_model=DataIngestionExecutionResponse)
async def abort_usd_brl_ingestion(
    execution_id: int,
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    execution = await service.abort_usd_brl_execution(execution_id)
    _revoke_pending_task(execution)
    return execution
