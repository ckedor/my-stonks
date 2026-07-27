"""Routes for brapi Opções sobre futuros endpoints."""

from typing import Annotated

from app.modules.brapi.api.future_options.schemas import (
    FutureOptionExpirationsQuery,
    FutureOptionStrikesQuery,
    FutureOptionChainQuery,
    FutureOptionHistoricalQuery,
    FutureOptionAnalyticsQuery,
    FutureOptionAnalyticsHistoryQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/futures/options', tags=['Opções sobre futuros'])


@router.get(
    '/expirations',
    summary='Vencimentos',
    description='Lista os vencimentos disponíveis das opções sobre um futuro.\n\nExemplo: `GET /brapi/v2/futures/options/expirations?underlying=BGI`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_expirations(
    query: Annotated[FutureOptionExpirationsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_expirations(
        underlying=query.underlying,
        include_expired=query.include_expired,
    )


@router.get(
    '/strikes',
    summary='Strikes',
    description='Lista os strikes disponíveis para um ativo num vencimento. Filtra por call ou put.\n\nExemplo: `GET /brapi/v2/futures/options/strikes?underlying=BGI&expirationDate=2026-08-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_strikes(
    query: Annotated[FutureOptionStrikesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_strikes(
        underlying=query.underlying,
        expiration_date=query.expiration_date,
        side=query.side,
    )


@router.get(
    '/chain',
    summary='Cadeia (calls + puts)',
    description='Cadeia completa de calls e puts de um vencimento, com o último preço de cada série.\n\nExemplo: `GET /brapi/v2/futures/options/chain?underlying=BGI&expirationDate=2026-08-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_chain(
    query: Annotated[FutureOptionChainQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_chain(
        underlying=query.underlying,
        expiration_date=query.expiration_date,
        date=query.date,
        side=query.side,
        min_strike=query.min_strike,
        max_strike=query.max_strike,
    )


@router.get(
    '/historical',
    summary='Histórico da opção',
    description='Série diária de uma opção sobre futuro, com OHLC e volume.\n\nExemplo: `GET /brapi/v2/futures/options/historical?symbol=BGIM26C028000&startDate=2026-05-01&endDate=2026-06-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_historical(
    query: Annotated[FutureOptionHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_historical(
        symbol=query.symbol,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )


@router.get(
    '/analytics',
    summary='Gregas e IV',
    description='Retorna volatilidade implícita e gregas EOD calculadas para opções sobre futuros de um vencimento. Opções europeias usam Black-76; opções americanas usam aproximação binomial sobre futuros. Quando não há dados suficientes, os campos calculados ficam `null` e `nullReason` explica o motivo.\n\nExemplo: `GET /brapi/v2/futures/options/analytics?underlying=BGI&expirationDate=2026-08-31&limit=50`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_analytics(
    query: Annotated[FutureOptionAnalyticsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_analytics(
        underlying=query.underlying,
        expiration_date=query.expiration_date,
        date=query.date,
        side=query.side,
        min_strike=query.min_strike,
        max_strike=query.max_strike,
        limit=query.limit,
    )


@router.get(
    '/analytics/history',
    summary='Histórico de gregas e IV',
    description='Retorna a série temporal EOD de volatilidade implícita e gregas calculadas para uma única opção sobre futuro.\n\nExemplo: `GET /brapi/v2/futures/options/analytics/history?symbol=BGIM26C028000&startDate=2026-05-01&endDate=2026-06-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_future_option_analytics_history(
    query: Annotated[FutureOptionAnalyticsHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_future_option_analytics_history(
        symbol=query.symbol,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )
