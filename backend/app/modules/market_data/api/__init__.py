from fastapi import APIRouter, Depends

from app.modules.market_data.api.asset.router import router as asset_router
from app.modules.market_data.api.broker.router import router as broker_router
from app.modules.market_data.api.index.router import router as index_router
from app.modules.market_data.api.ingestion.router import router as ingestion_router
from app.modules.market_data.api.quote.router import router as quote_router
from app.modules.market_data.api.series.router import router as series_router
from app.modules.market_data.api.usd_brl.router import router as usd_brl_router
from app.modules.users.views import current_active_user

router = APIRouter(prefix='/market_data', dependencies=[Depends(current_active_user)])
router.include_router(index_router)
router.include_router(quote_router)
router.include_router(asset_router)
router.include_router(broker_router)
router.include_router(ingestion_router)
router.include_router(series_router)
router.include_router(usd_brl_router)

__all__ = ['router']
