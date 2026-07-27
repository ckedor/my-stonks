"""Routes for brapi Inflação endpoints."""

from typing import Annotated

from app.modules.brapi.api.inflation.schemas import (
    InflationQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/inflation', tags=['Inflação'])


@router.get(
    '',
    summary='Obter Dados de Inflação (IPCA)',
    description='Retorna dados históricos do **IPCA (Índice Nacional de Preços ao Consumidor Amplo)**, o índice oficial de inflação do Brasil, medido pelo IBGE.\n\nExemplo: `GET /brapi/v2/inflation?historical=false&start=01%2F01%2F2023&end=31%2F12%2F2023`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_inflation(
    query: Annotated[InflationQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_inflation(
        historical=query.historical,
        start=query.start,
        end=query.end,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/available',
    summary='Listar Países com Dados de Inflação',
    description='Retorna a lista de países disponíveis para consulta de dados de inflação.\n\nExemplo: `GET /brapi/v2/inflation/available`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_inflation_available(
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_inflation_available()
