"""Compatibility API for the former quote-only ingestion URL."""

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_data_ingestion_read_service,
    get_data_ingestion_service,
)
from app.modules.market_data.api.quote_ingestion.schemas import (
    QuoteIngestionExecutionDetailResponse,
    QuoteIngestionExecutionResponse,
    RunQuoteIngestionRequest,
)
from app.modules.market_data.service.data_ingestion_service import (
    DataIngestionReadService,
    DataIngestionService,
)
from app.modules.users.domain import User
from app.modules.users.views import current_superuser

router = APIRouter(
    prefix='/quote_ingestion',
    tags=['Quote Ingestion'],
    dependencies=[Depends(current_superuser)],
)


@router.get('', response_model=list[QuoteIngestionExecutionResponse])
async def list_quote_ingestions(
    limit: int = Query(default=50, ge=1, le=200),
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.list_quote_executions(limit=limit)


@router.get('/{execution_id}', response_model=QuoteIngestionExecutionDetailResponse)
async def get_quote_ingestion(
    execution_id: int,
    service: DataIngestionReadService = Depends(get_data_ingestion_read_service),
):
    return await service.get_quote_execution(execution_id)


@router.post('', response_model=QuoteIngestionExecutionResponse)
async def run_quote_ingestion(
    payload: RunQuoteIngestionRequest,
    user: User = Depends(current_superuser),
    service: DataIngestionService = Depends(get_data_ingestion_service),
):
    return await service.request_quote_execution(
        requested_by_user_id=user.id,
        item_ids=payload.asset_ids,
        force_full_history=payload.force_full_history,
    )
