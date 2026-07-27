"""Routes for brapi Câmbio endpoints."""

from typing import Annotated

from app.modules.brapi.api.currency.schemas import (
    CurrencyQuery,
    CurrencyHistoricalQuery,
    CurrencyAvailableQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/currency', tags=['Câmbio'])


@router.get(
    '',
    summary='Obter Cotações de Câmbio',
    description='Retorna cotações atualizadas de pares de moedas, com preço de compra/venda, variação e extremos do dia.\n\nExemplo: `GET /brapi/v2/currency?currency=USD-BRL`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_currency(
    query: Annotated[CurrencyQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_currency(
        currency=query.currency,
    )


@router.get(
    '/historical',
    summary='Histórico de Cotações de Câmbio',
    description='Retorna séries históricas diárias de câmbio em três formas, todas derivadas das mesmas cotações PTAX de fechamento: - **Direto** (X-BRL) — cotação diária do par armazenado. Disponível a partir do plano Startup. - **Inverso** (BRL-X) — calculado como `1 / X-BRL`. Requer plano Pro. - **Cross-rate** (X-Y, nenhum dos dois é BRL) — calculado como `X-BRL / Y-BRL` em cada data com observação em ambas as séries. Requer plano Pro.\n\nExemplo: `GET /brapi/v2/currency/historical?currency=USD-BRL,EUR-BRL&startDate=2024-01-01&endDate=2024-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_currency_historical(
    query: Annotated[CurrencyHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_currency_historical(
        currency=query.currency,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
        limit=query.limit,
    )


@router.get(
    '/available',
    summary='Listar Pares de Moedas Disponíveis',
    description='Retorna a lista de pares de moedas disponíveis para consulta no endpoint `/api/v2/currency`.\n\nExemplo: `GET /brapi/v2/currency/available?search=USD`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_currency_available(
    query: Annotated[CurrencyAvailableQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_currency_available(
        search=query.search,
    )
