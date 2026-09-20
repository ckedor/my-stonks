"""Asset, asset type, FII/ETF, fixed income, treasury bond, event and exchange routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.composition.market_data import (
    get_asset_catalogue_sync_service,
    get_asset_service,
    get_cvm_registry_sync_service,
    get_fund_registry_link_service,
)
from app.modules.market_data.api.asset.schemas import (
    AssetCreate,
    AssetDetailsOut,
    AssetEvent,
    AssetSyncReport,
    AssetType,
    AssetUpdate,
    CvmRegistrySyncReport,
    ExchangeOut,
    FavoriteAsset,
    FavoriteAssetFilters,
    FixedIncomeAsset,
    FixedIncomeType,
    FundLinkRequest,
    FundLinkResult,
    FundLinkSuggestionReport,
    TreasuryBondTypeOut,
)
from app.modules.market_data.api.fund_registry.schemas import (
    ConfirmSeriesAliasesRequest,
    FundShareSeriesAliasOut,
    RegisterFundRequest,
    SelectFundSeriesRequest,
)
from app.modules.market_data.service.asset_catalogue_sync_service import (
    AssetCatalogueSyncService,
)
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.cvm_registry_sync_service import (
    CvmRegistrySyncService,
)
from app.modules.market_data.service.fund_registry_link_service import (
    FundRegistryLinkService,
)
from app.modules.users.domain import User
from app.modules.users.views import current_active_user, current_superuser

router = APIRouter(prefix='/asset', tags=['Asset'])


# ---------------------------------------------------------------------------
# Auxiliary listings (declared first to avoid clashing with /{asset_id})
# ---------------------------------------------------------------------------
@router.get('/type', response_model=list[AssetType])
async def list_asset_types(
    service: AssetService = Depends(get_asset_service),
):
    """List all asset types."""
    return await service.list_asset_types()


@router.post('/fixed_income')
async def create_fixed_income(
    fixed_income: FixedIncomeAsset,
    service: AssetService = Depends(get_asset_service),
):
    """Create a new fixed income asset."""
    return await service.create_fixed_income(fixed_income.model_dump())


@router.get('/fixed_income/type', response_model=list[FixedIncomeType])
async def list_fixed_income_types(
    service: AssetService = Depends(get_asset_service),
):
    """List all fixed income types."""
    return await service.list_fixed_income_types()


@router.get('/fii/segment')
async def list_fii_segments(
    service: AssetService = Depends(get_asset_service),
):
    """List FII segments."""
    return await service.list_fii_segments()


@router.get('/etf/segment')
async def list_etf_segments(
    service: AssetService = Depends(get_asset_service),
):
    """List all ETF segments."""
    return await service.list_etf_segments()


@router.get('/treasury_bond/type', response_model=list[TreasuryBondTypeOut])
async def list_treasury_bond_types(
    service: AssetService = Depends(get_asset_service),
):
    """List all treasury bond types."""
    return await service.list_treasury_bond_types()


@router.post('/fund', dependencies=[Depends(current_active_user)])
async def register_fund(
    payload: RegisterFundRequest,
    service: AssetService = Depends(get_asset_service),
):
    """Make one priced unit of a registered fund class an FI or PREV asset."""
    return await service.register_fund(**payload.model_dump())


@router.put('/fund/{asset_id}/series', dependencies=[Depends(current_superuser)])
async def select_fund_series(
    asset_id: int,
    payload: SelectFundSeriesRequest,
    service: AssetService = Depends(get_asset_service),
):
    """Confirm the series of a legacy FIDC asset without replacing its transactions."""
    return await service.select_fund_series(asset_id, **payload.model_dump())


@router.put(
    '/fund/{asset_id}/series-aliases',
    response_model=list[FundShareSeriesAliasOut],
    dependencies=[Depends(current_superuser)],
)
async def confirm_fund_series_aliases(
    asset_id: int,
    payload: ConfirmSeriesAliasesRequest,
    service: AssetService = Depends(get_asset_service),
):
    """Confirm filing labels that meant the asset's series, keeping earlier ones.

    Share values applied under the previous aliases stop counting as covered,
    so the next share-value ingestion re-reads the asset's history.
    """
    return await service.confirm_series_aliases(
        asset_id, [alias.model_dump() for alias in payload.aliases]
    )


@router.get('/exchange', response_model=list[ExchangeOut])
async def list_exchanges(
    service: AssetService = Depends(get_asset_service),
):
    """List all exchanges."""
    return await service.list_exchanges()


@router.get('/favorites', response_model=list[FavoriteAsset])
async def list_favorite_assets(
    filters: Annotated[FavoriteAssetFilters, Query()],
    user: User = Depends(current_active_user),
    service: AssetService = Depends(get_asset_service),
):
    """The assets this user opens most often."""
    return await service.list_favorite_assets(
        user.id,
        filters.limit,
        filters.asset_type_id,
        asset_ids=filters.asset_ids,
        brazilian=filters.brazilian,
    )


@router.post('/{asset_id}/visit', status_code=204)
async def record_asset_visit(
    asset_id: int,
    user: User = Depends(current_active_user),
    service: AssetService = Depends(get_asset_service),
):
    """Count a visit, which is what ranks the favourites."""
    await service.record_visit(user.id, asset_id)


# ---------------------------------------------------------------------------
# Asset Event sub-resource
# ---------------------------------------------------------------------------
@router.get(
    '/event',
    response_model=list[AssetEvent],
    dependencies=[Depends(current_superuser)],
)
async def list_events(
    service: AssetService = Depends(get_asset_service),
):
    """List all asset events."""
    return await service.list_events()


@router.post('/event', dependencies=[Depends(current_superuser)])
async def create_event(
    event: AssetEvent,
    service: AssetService = Depends(get_asset_service),
):
    """Create a new asset event."""
    return await service.create_event(event)


@router.put('/event/{event_id}', dependencies=[Depends(current_superuser)])
async def update_event(
    event_id: int,
    event: AssetEvent,
    service: AssetService = Depends(get_asset_service),
):
    """Update an asset event."""
    payload = event.model_copy(update={'id': event_id})
    return await service.update_event(payload)


@router.delete('/event/{event_id}', dependencies=[Depends(current_superuser)])
async def delete_event(
    event_id: int,
    service: AssetService = Depends(get_asset_service),
):
    """Delete an asset event."""
    await service.delete_event(event_id)
    return {'message': 'OK'}


# ---------------------------------------------------------------------------
# Catalogue sync
# ---------------------------------------------------------------------------
@router.post('/sync', response_model=AssetSyncReport, dependencies=[Depends(current_superuser)])
async def sync_assets_with_catalogue(
    kinds: list[str] | None = Query(default=None),
    dry_run: bool = Query(default=True),
    service: AssetCatalogueSyncService = Depends(get_asset_catalogue_sync_service),
):
    """Casar o cadastro local com o catálogo do provedor.

    Nomes e logos vêm do provedor, tickers que faltam viram ativos novos, e o
    que só existe aqui continua existindo. `dry_run` é o padrão porque a rota
    reescreve dado que a tela mostra: primeiro se olha o relatório, depois se
    repete com `dry_run=false`.
    """
    return await service.sync(kinds=kinds, dry_run=dry_run)


@router.post(
    '/registry_sync',
    response_model=CvmRegistrySyncReport,
    dependencies=[Depends(current_superuser)],
)
async def sync_assets_with_regulator(
    dry_run: bool = Query(default=True),
    service: CvmRegistrySyncService = Depends(get_cvm_registry_sync_service),
):
    """Casar o cadastro local com o que a CVM publica sobre companhias.

    Preenche as pessoas jurídicas e liga cada ação à companhia que a emitiu,
    com a espécie do papel e o segmento de listagem que vêm junto. `dry_run` é
    o padrão porque a rota reescreve dado que a tela mostra: primeiro se lê o
    relatório, depois se repete com `dry_run=false`.
    """
    return await service.sync(dry_run=dry_run)


@router.get(
    '/fund_link/suggestions',
    response_model=FundLinkSuggestionReport,
    dependencies=[Depends(current_superuser)],
)
async def suggest_fund_links(
    service: FundRegistryLinkService = Depends(get_fund_registry_link_service),
):
    """As propostas de vínculo entre um FII e o fundo registrado na CVM.

    Só propõe: um CNPJ que aponta para mais de um registro sai como ambíguo, e
    um que o registro não conhece sai como desconhecido. Nenhum dos dois vira
    palpite, e nada é gravado aqui.
    """
    return await service.suggest_fii_links()


@router.post(
    '/fund_link',
    response_model=FundLinkResult,
    dependencies=[Depends(current_superuser)],
)
async def link_asset_to_fund_registry(
    payload: FundLinkRequest,
    service: FundRegistryLinkService = Depends(get_fund_registry_link_service),
):
    """Confirma o vínculo de um FII ou ETF com um fundo do registro.

    É por aqui que o ETF entra: o catálogo do provedor não traz o CNPJ dele,
    então o fundo é achado pela busca do registro e confirmado à mão.
    """
    return await service.link(
        asset_id=payload.asset_id,
        fund_registry_id=payload.fund_registry_id,
    )


# ---------------------------------------------------------------------------
# Asset CRUD
# ---------------------------------------------------------------------------
@router.get('')
async def list_assets(
    service: AssetService = Depends(get_asset_service),
):
    """List all assets (cached for 24h)."""
    return await service.list_assets()


@router.post('')
async def create_asset(
    data: AssetCreate,
    service: AssetService = Depends(get_asset_service),
):
    """Create a new asset with subclass data."""
    return await service.create_asset(data.model_dump())


@router.get('/{asset_id}', response_model=AssetDetailsOut)
async def get_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
):
    """Get a single asset with all details."""
    return await service.get_asset(asset_id)


@router.put('/{asset_id}')
async def update_asset(
    asset_id: int,
    data: AssetUpdate,
    service: AssetService = Depends(get_asset_service),
):
    """Update an asset with subclass data."""
    return await service.update_asset({**data.model_dump(), 'id': asset_id})


@router.delete('/{asset_id}')
async def delete_asset(
    asset_id: int,
    service: AssetService = Depends(get_asset_service),
):
    """Delete an asset by ID."""
    return await service.delete_asset(asset_id)
