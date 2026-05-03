from app.modules.market_data.api.asset.router import router as asset_router
from app.modules.market_data.api.broker.router import router as broker_router
from app.modules.market_data.api.index.router import router as index_router
from app.modules.market_data.api.quote.router import router as quote_router
from app.modules.users.views import current_active_user
from fastapi import APIRouter, Depends

router = APIRouter(prefix='/market_data', dependencies=[Depends(current_active_user)])
router.include_router(index_router)
router.include_router(quote_router)
router.include_router(asset_router)
router.include_router(broker_router)

__all__ = ['router']
