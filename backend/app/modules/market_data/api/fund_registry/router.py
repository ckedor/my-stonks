"""The regulator's fund registry: search it, and read a class before it is an asset."""

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_fund_registry_read_service,
    get_fund_series_read_service,
)
from app.modules.market_data.api.asset.schemas import RegisteredFundOut
from app.modules.market_data.api.fund_registry.schemas import (
    FundRegistryClassDetailOut,
    FundRegistryClassOut,
    FundSeriesFilingOut,
    FundShareSeriesOut,
)
from app.modules.market_data.service.fund_registry_service import (
    FundRegistryReadService,
    FundSeriesReadService,
)
from app.modules.users.views import current_active_user

router = APIRouter(
    prefix='/fund_registry',
    tags=['Fund registry'],
    dependencies=[Depends(current_active_user)],
)


@router.get('', response_model=list[FundRegistryClassOut])
async def search_fund_registry(
    search: str | None = Query(default=None, max_length=120),
    kind: str | None = Query(default=None, max_length=20),
    status: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=30, ge=1, le=100),
    service: FundRegistryReadService = Depends(get_fund_registry_read_service),
):
    """Registered classes by name, CNPJ, administrator or manager."""
    return await service.search(query=search, kind=kind, status=status, limit=limit)


@router.get('/fund', response_model=list[RegisteredFundOut])
async def search_registered_funds(
    query: str | None = Query(default=None, description='Nome, CNPJ, administrador ou gestor'),
    kind: str | None = Query(default=None, description='Tipo do fundo no registro: FII, FIIM, FIF'),
    limit: int = Query(default=20, ge=1, le=100),
    service: FundRegistryReadService = Depends(get_fund_registry_read_service),
):
    """Busca no cadastro de fundos, no nível do fundo.

    É a contraparte de `/class` um nível acima, e é como um ETF é achado: o
    catálogo do provedor não devolve o CNPJ dele, então o fundo é procurado
    pelo nome e o vínculo é confirmado à mão.
    """
    return await service.search_funds(query=query, kind=kind, limit=limit)


@router.get('/class/{class_id}', response_model=FundRegistryClassDetailOut)
async def get_fund_registry_class(
    class_id: int,
    service: FundRegistryReadService = Depends(get_fund_registry_read_service),
):
    """A class with its fund, subclasses, known series and the units already assets."""
    detail = await service.get_class(class_id)
    return FundRegistryClassDetailOut(
        registry_class=FundRegistryClassOut.model_validate(detail.registry_class),
        subclasses=detail.subclasses,
        series=[
            FundShareSeriesOut(id=series.id, name=series.name, aliases=aliases)
            for series, aliases in detail.series
        ],
        registered_units=detail.registered_units,
    )


@router.get('/class/{class_id}/series', response_model=FundSeriesFilingOut)
async def get_fund_registry_class_series(
    class_id: int,
    service: FundSeriesReadService = Depends(get_fund_series_read_service),
):
    """The series a FIDC class filed most recently, read from the source now.

    Works before the class is an asset, and writes nothing.
    """
    return await service.get_series_filing(class_id)
