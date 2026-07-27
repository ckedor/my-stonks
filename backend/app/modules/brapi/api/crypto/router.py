"""Routes for brapi Criptomoedas endpoints."""

from typing import Annotated

from app.modules.brapi.api.crypto.schemas import (
    CryptoQuery,
    CryptoAvailableQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/crypto', tags=['Criptomoedas'])


@router.get(
    '',
    summary='Obter Cotações de Criptomoedas',
    description='Retorna cotações atualizadas de uma ou mais criptomoedas, com conversão para diferentes moedas fiduciárias.\n\nExemplo: `GET /brapi/v2/crypto?coin=BTC,ETH&currency=BRL`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_crypto(
    query: Annotated[CryptoQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_crypto(
        coin=query.coin,
        currency=query.currency,
        range=query.range,
        interval=query.interval,
    )


@router.get(
    '/available',
    summary='Listar Criptomoedas Disponíveis',
    description='Retorna a lista de criptomoedas disponíveis para consulta no endpoint `/api/v2/crypto`.\n\nExemplo: `GET /brapi/v2/crypto/available?search=BTC`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_crypto_available(
    query: Annotated[CryptoAvailableQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_crypto_available(
        search=query.search,
    )
