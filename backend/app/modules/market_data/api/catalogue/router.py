from typing import Literal

from fastapi import APIRouter, Depends

from app.composition.market_data import get_market_catalogue_read_service
from app.modules.market_data.api.catalogue.schemas import MarketCatalogueResponse
from app.modules.market_data.service.market_catalogue_service import MarketCatalogueReadService

router = APIRouter(prefix='/market', tags=['Market Catalogue'])


@router.get('/{kind}', response_model=MarketCatalogueResponse)
async def get_market_catalogue(
    kind: Literal['stock', 'etf', 'fii', 'bdr', 'crypto'],
    service: MarketCatalogueReadService = Depends(get_market_catalogue_read_service),
):
    """Complete BRAPI catalogue for one market class."""
    return await service.list_market(kind)
