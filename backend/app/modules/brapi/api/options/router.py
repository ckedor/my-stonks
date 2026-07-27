"""Routes for brapi Opções endpoints."""

from typing import Annotated

from app.modules.brapi.api.options.schemas import (
    OptionExpirationsQuery,
    OptionStrikesQuery,
    OptionChainQuery,
    OptionHistoricalQuery,
    OptionAnalyticsQuery,
    OptionAnalyticsHistoryQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/options', tags=['Opções'])


@router.get(
    '/expirations',
    summary='Listar vencimentos de opções',
    description='Retorna os vencimentos disponíveis para um ativo subjacente. Sem token, o sandbox aceita apenas `underlying=PETR4`.\n\nExemplo: `GET /brapi/v2/options/expirations?underlying=PETR4`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_expirations(
    query: Annotated[OptionExpirationsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_expirations(
        underlying=query.underlying,
        include_expired=query.include_expired,
    )


@router.get(
    '/strikes',
    summary='Listar preços de exercício de opções',
    description='Retorna os strikes disponíveis em um vencimento específico. Sem token, o sandbox aceita apenas `underlying=PETR4`.\n\nExemplo: `GET /brapi/v2/options/strikes?underlying=PETR4&expirationDate=2026-12-18`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_strikes(
    query: Annotated[OptionStrikesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_strikes(
        underlying=query.underlying,
        expiration_date=query.expiration_date,
        side=query.side,
    )


@router.get(
    '/chain',
    summary='Listar séries negociadas de opções',
    description='Retorna as séries negociadas de um vencimento, combinando metadados do contrato com o último OHLCV disponível até a data solicitada. Sem token, o sandbox aceita apenas `underlying=PETR4`.\n\nExemplo: `GET /brapi/v2/options/chain?underlying=PETR4&expirationDate=2026-12-18&date=2026-06-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_chain(
    query: Annotated[OptionChainQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_chain(
        underlying=query.underlying,
        expiration_date=query.expiration_date,
        date=query.date,
        side=query.side,
        min_strike=query.min_strike,
        max_strike=query.max_strike,
    )


@router.get(
    '/historical',
    summary='Obter histórico diário de uma série de opção',
    description='Retorna o histórico diário EOD de uma única série, identificada por `symbol` e `expirationDate`. Sem token, o sandbox aceita apenas símbolos com prefixo `PETR` (opções de PETR4).\n\nExemplo: `GET /brapi/v2/options/historical?symbol=PETRF783&expirationDate=2026-12-18&strike=7.29`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_historical(
    query: Annotated[OptionHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_historical(
        symbol=query.symbol,
        expiration_date=query.expiration_date,
        strike=query.strike,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )


@router.get(
    '/analytics',
    summary='Obter gregas e volatilidade implícita de opções',
    description='Retorna IV e gregas EOD calculadas para as séries de um vencimento. Os cálculos usam apenas preços EOD observados; quando uma série não tem dados suficientes, os campos calculados ficam `null` e `nullReason` explica o motivo. Sem token, o sandbox aceita apenas `underlying=PETR4`.\n\nExemplo: `GET /brapi/v2/options/analytics?underlying=PETR4&expirationDate=2026-12-18&date=2026-06-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_analytics(
    query: Annotated[OptionAnalyticsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_analytics(
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
    summary='Obter histórico de gregas e IV de uma série de opção',
    description='Retorna a série temporal EOD de IV e gregas calculadas para uma única opção. Sem token, o sandbox aceita apenas símbolos com prefixo `PETR`.\n\nExemplo: `GET /brapi/v2/options/analytics/history?symbol=PETRF783&expirationDate=2026-12-18&strike=7.29`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_option_analytics_history(
    query: Annotated[OptionAnalyticsHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_option_analytics_history(
        symbol=query.symbol,
        expiration_date=query.expiration_date,
        strike=query.strike,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )
