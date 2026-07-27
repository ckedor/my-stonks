"""Routes for brapi Macroeconomia endpoints."""

from typing import Annotated

from app.modules.brapi.api.macro.schemas import (
    MacroAvailableQuery,
    MacroSeriesQuery,
    MacroLatestQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/macro', tags=['Macroeconomia'])


@router.get(
    '/available',
    summary='Listar séries macroeconômicas disponíveis',
    description='Lista as séries macroeconômicas disponíveis com slug, nome, unidade, frequência, categoria e data de início do histórico. Endpoint público (use para descobrir slugs antes de chamar `/api/v2/macro` ou `/api/v2/macro/latest`).\n\nExemplo: `GET /brapi/v2/macro/available?q=juros&category=interestRate`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_macro_available(
    query: Annotated[MacroAvailableQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_macro_available(
        q=query.q,
        category=query.category,
    )


@router.get(
    '',
    summary='Séries históricas de indicadores macroeconômicos',
    description='Retorna observações históricas para uma ou mais séries macroeconômicas brasileiras (taxas de juros, inflação, agregados monetários e atividade).\n\nExemplo: `GET /brapi/v2/macro?symbols=selic,ipca&startDate=2025-01-01&endDate=2026-04-30`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_macro_series(
    query: Annotated[MacroSeriesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_macro_series(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
        limit=query.limit,
    )


@router.get(
    '/latest',
    summary='Último valor de cada série macroeconômica',
    description='Snapshot dos valores mais recentes para uma lista de séries (ou todas, se `symbols` for omitido).\n\nExemplo: `GET /brapi/v2/macro/latest?symbols=selic,cdi,ipca`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_macro_latest(
    query: Annotated[MacroLatestQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_macro_latest(
        symbols=query.symbols,
    )
