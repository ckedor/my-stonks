from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import get_usd_brl_read_service
from app.modules.market_data.api.usd_brl.schemas import (
    UsdBrlConversionRequest,
    UsdBrlConversionResponse,
    UsdBrlHistoryPoint,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService

router = APIRouter(prefix='/usd-brl', tags=['USD/BRL'])


@router.get('/history', response_model=list[UsdBrlHistoryPoint])
async def get_usd_brl_history(
    service: Annotated[UsdBrlReadService, Depends(get_usd_brl_read_service)],
    start_date: Annotated[date | None, Query()] = None,
):
    return await service.get_history(start_date=start_date)


@router.post('/convert', response_model=UsdBrlConversionResponse)
async def convert_usd_brl(
    payload: UsdBrlConversionRequest,
    service: Annotated[UsdBrlReadService, Depends(get_usd_brl_read_service)],
):
    return await service.convert(
        amount=payload.amount,
        direction=payload.direction,
        target_date=payload.date,
    )
