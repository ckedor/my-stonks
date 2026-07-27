"""Routes for brapi Taxa de juros endpoints."""

from typing import Annotated

from app.modules.brapi.api.prime_rate.schemas import (
    PrimeRateQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/prime-rate', tags=['Taxa de juros'])


@router.get(
    '',
    summary='Obter Dados da Taxa SELIC',
    description='Retorna dados históricos da **Taxa SELIC (Sistema Especial de Liquidação e de Custódia)**, a taxa básica de juros da economia brasileira, definida pelo COPOM (Comitê de Política Monetária) do Banco Central.\n\nExemplo: `GET /brapi/v2/prime-rate?historical=false&start=01%2F01%2F2023&end=31%2F12%2F2023`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_prime_rate(
    query: Annotated[PrimeRateQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_prime_rate(
        historical=query.historical,
        start=query.start,
        end=query.end,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/available',
    summary='Listar Países com Dados de Taxa de Juros',
    description='Retorna a lista de países disponíveis para consulta de dados de taxa de juros.\n\nExemplo: `GET /brapi/v2/prime-rate/available`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_prime_rate_available(
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_prime_rate_available()
