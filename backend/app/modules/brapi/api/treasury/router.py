"""Routes for brapi Tesouro Direto endpoints."""

from typing import Annotated

from app.modules.brapi.api.treasury.schemas import (
    TreasuryListQuery,
    TreasuryIndicatorsQuery,
    TreasuryIndicatorsHistoryQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/treasury', tags=['Tesouro Direto'])


@router.get(
    '/list',
    summary='Lista títulos do Tesouro Direto',
    description='Retorna os títulos do Tesouro Direto atualmente ofertados, com taxas e preços indicativos mais recentes. Requer plano Pro, exceto pelos três títulos sandbox documentados.\n\nExemplo: `GET /brapi/v2/treasury/list?page=1&limit=20&search=tesouro-selic-01032031`',
    response_description='Resposta original retornada pela brapi.',
)
async def list_treasury(
    query: Annotated[TreasuryListQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.list_treasury(
        page=query.page,
        limit=query.limit,
        search=query.search,
        indexer=query.indexer,
        coupon_type=query.coupon_type,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/indicators',
    summary='Consulta indicadores atuais de títulos do Tesouro Direto',
    description='Retorna a última taxa/preço indicativo para cada símbolo solicitado. Símbolos desconhecidos são omitidos de results.\n\nExemplo: `GET /brapi/v2/treasury/indicators?symbols=tesouro-selic-01032031,tesouro-ipca-15052035`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_treasury_indicators(
    query: Annotated[TreasuryIndicatorsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_treasury_indicators(
        symbols=query.symbols,
    )


@router.get(
    '/indicators/history',
    summary='Consulta histórico diário de indicadores do Tesouro Direto',
    description='Retorna a série diária de taxas e preços indicativos por título do Tesouro Direto. Quando startDate e endDate são omitidos, usa os últimos 12 meses.\n\nExemplo: `GET /brapi/v2/treasury/indicators/history?symbols=tesouro-selic-01032031,tesouro-ipca-15052035&startDate=2025-01-01&endDate=2026-05-15`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_treasury_indicators_history(
    query: Annotated[TreasuryIndicatorsHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_treasury_indicators_history(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )
