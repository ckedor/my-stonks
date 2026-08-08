from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_data_ingestion_read_service,
    get_data_ingestion_service,
)
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

router = APIRouter(
    prefix='/ingestions',
    tags=['Data Ingestion'],
    dependencies=[Depends(current_superuser)],
)


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
    return await service.request_quote_execution(
        requested_by_user_id=user.id,
        item_ids=payload.item_ids,
        force_full_history=payload.force_full_history,
    )


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
    return await service.request_series_execution(
        requested_by_user_id=user.id,
        force_full_history=payload.force_full_history,
    )


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
    return await service.request_usd_brl_execution(
        requested_by_user_id=user.id,
        force_full_history=payload.force_full_history,
    )
