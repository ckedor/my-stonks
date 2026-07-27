"""Routes for brapi Tickers endpoints."""

from typing import Annotated

from app.modules.brapi.api.tickers.schemas import (
    TickerRenamesQuery,
    ResolveTickersQuery,
    TickerCoverageQuery,
    TickersQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/tickers', tags=['Tickers'])


@router.get(
    '/renames',
    summary='Listar renomes de tickers',
    description='Lista renomes conhecidos de tickers B3. Use este endpoint para descobrir quando um ticker antigo passou a negociar sob outro código, incluindo cadeias de renome normalizadas para o ticker canônico atual.\n\nExemplo: `GET /brapi/v2/tickers/renames?symbols=VVAR3,BHIA3&search=BHIA&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_ticker_renames(
    query: Annotated[TickerRenamesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_ticker_renames(
        symbols=query.symbols,
        search=query.search,
        start_date=query.start_date,
        end_date=query.end_date,
    )


@router.get(
    '/resolve',
    summary='Resolver tickers antigos',
    description='Resolve tickers antigos para o ticker atual recomendado. Tickers sem renome conhecido são retornados sem alteração, o que permite normalizar uma lista antes de chamar endpoints de dados de mercado.\n\nExemplo: `GET /brapi/v2/tickers/resolve?symbols=VVAR3,PETR4`',
    response_description='Resposta original retornada pela brapi.',
)
async def resolve_tickers(
    query: Annotated[ResolveTickersQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.resolve_tickers(
        symbols=query.symbols,
    )


@router.get(
    '/coverage',
    summary='Verificar cobertura por ticker',
    description='Verifica quais superfícies de dados da brapi estão disponíveis para cada ticker informado e recomenda os endpoints corretos para continuar a integração. Use este endpoint quando precisar responder "o que posso consultar para este ativo?" antes de chamar cotações, histórico, dividendos, fundamentos ou endpoints específicos de FIIs.\n\nExemplo: `GET /brapi/v2/tickers/coverage?symbols=PETR4,MXRF11,VVAR3`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_ticker_coverage(
    query: Annotated[TickerCoverageQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_ticker_coverage(
        symbols=query.symbols,
    )


@router.get(
    '',
    summary='Listar tickers disponíveis',
    description='Lista tickers e instrumentos B3 disponíveis na brapi usando o padrão v2. Use este endpoint para descoberta de símbolos, autocomplete, validação de ticker e telas de screening. Ele substitui gradualmente `/api/quote/list` para novas integrações, mas não retorna módulos, dividendos ou histórico completo. Para dados de mercado de ações em novas integrações, use os endpoints composáveis `/api/v2/stocks/*`. Para FIIs, use `/api/v2/fii/*`.\n\nExemplo: `GET /brapi/v2/tickers?search=PETR&sortBy=volume&sortOrder=desc`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_tickers(
    query: Annotated[TickersQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_tickers(
        search=query.search,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        page=query.page,
        limit=query.limit,
        sector=query.sector,
        subsector=query.subsector,
        type=query.type,
        sub_type=query.sub_type,
    )
