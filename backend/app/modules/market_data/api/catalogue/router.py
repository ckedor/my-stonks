from typing import Literal

from fastapi import APIRouter, Depends

from app.composition.market_data import get_market_catalogue_read_service
from app.modules.market_data.api.catalogue.schemas import MarketCatalogueResponse
from app.modules.market_data.service.market_catalogue_service import MarketCatalogueReadService

router = APIRouter(prefix='/market', tags=['Market Catalogue'])


@router.get('/{kind}', response_model=MarketCatalogueResponse)
async def get_market_catalogue(
    kind: Literal['stock', 'etf', 'fii', 'bdr', 'crypto', 'stock-us', 'etf-us'],
    service: MarketCatalogueReadService = Depends(get_market_catalogue_read_service),
):
    """O universo de uma classe: catálogo da BRAPI na B3, cadastro fora dela."""
    return await service.list_market(kind)
