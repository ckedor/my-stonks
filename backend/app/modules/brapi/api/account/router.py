"""Routes for brapi Conta endpoints."""

from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends

router = APIRouter(prefix='/user', tags=['Conta'])


@router.get(
    '/usage',
    summary='Obter uso atual da conta autenticada',
    description='Retorna o uso atual da conta autenticada usando a mesma contagem cacheada do limitador de uso.\n\nExemplo: `GET /brapi/v2/user/usage`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_user_usage(
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_user_usage()
