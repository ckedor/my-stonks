from app.modules.ai import router as ai_router
from app.modules.asset import router as asset_router
from app.modules.brokers import router as brokers_router
from app.modules.market_data import router as market_data_router
from app.modules.portfolio import router as portfolio_router
from fastapi import APIRouter

router = APIRouter()

router.include_router(ai_router)
router.include_router(asset_router)
router.include_router(market_data_router)
router.include_router(portfolio_router)
router.include_router(brokers_router)


@router.get('/hc', tags=['Health Check'])
async def healthcheck():
    return {'status': 'ok'}
