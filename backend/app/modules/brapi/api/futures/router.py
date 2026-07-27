"""Routes for brapi Futuros endpoints."""

from typing import Annotated

from app.modules.brapi.api.futures.schemas import (
    FuturesListQuery,
    FutureQuotesQuery,
    FutureSpecsQuery,
    FutureHistoricalQuery,
    FutureTermStructureQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/futures', tags=['Futuros'])


@router.get(
    '/list',
    summary='Listar contratos futuros',
    description='Retorna a lista de contratos futuros, com filtros por ativo, segmento e vencimento.\n\nExemplo: `GET /brapi/v2/futures/list?asset=BGI`',
    response_description='Resposta original retornada pela brapi.',
)
async def list_futures(
    query: Annotated[FuturesListQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.list_futures(
        asset=query.asset,
        segment=query.segment,
        include_expired=query.include_expired,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/quote',
    summary='Cotação do dia',
    description='Retorna a cotação do último pregão para os contratos pedidos. Máx. 20 símbolos por requisição.\n\nExemplo: `GET /brapi/v2/futures/quote?symbols=WINM26,BGIF27,DI1F27`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_quotes(
    query: Annotated[FutureQuotesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_quotes(
        symbols=query.symbols,
    )


@router.get(
    '/specs',
    summary='Especificações do contrato',
    description='Retorna só os dados do contrato (vencimento, multiplicador, lote, ISIN), sem preço.\n\nExemplo: `GET /brapi/v2/futures/specs?symbols=WINM26,BGIF27,DI1F27`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_specs(
    query: Annotated[FutureSpecsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_specs(
        symbols=query.symbols,
    )


@router.get(
    '/historical',
    summary='Histórico do contrato',
    description='Série diária de um contrato, com OHLC, ajuste e taxa (em DI/DAP).\n\nExemplo: `GET /brapi/v2/futures/historical?symbol=WINM26`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_historical(
    query: Annotated[FutureHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_historical(
        symbol=query.symbol,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )


@router.get(
    '/term-structure',
    summary='Curva de vencimentos',
    description='Retorna todos os contratos do mesmo ativo, com o último pregão de cada um, do vencimento mais próximo para o mais distante.\n\nExemplo: `GET /brapi/v2/futures/term-structure?asset=BGI`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_term_structure(
    query: Annotated[FutureTermStructureQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_term_structure(
        asset=query.asset,
        include_expired=query.include_expired,
    )
