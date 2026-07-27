"""Routes for brapi Dicionário endpoints."""

from typing import Annotated

from app.modules.brapi.api.dictionary.schemas import (
    DictionaryQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/dictionary', tags=['Dicionário'])


@router.get(
    '',
    summary='Dicionário de Campos da API',
    description='Retorna o dicionário completo de todos os campos disponíveis na API, com nome em português, descrição detalhada e fórmula de cálculo.\n\nExemplo: `GET /brapi/v2/dictionary?search=patrim%C3%B4nio&category=treasury`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_dictionary(
    query: Annotated[DictionaryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_dictionary(
        search=query.search,
        category=query.category,
    )
