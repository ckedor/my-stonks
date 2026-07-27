"""Aggregate router for the brapi module."""

from app.modules.brapi.api.crypto.router import router as crypto_router
from app.modules.brapi.api.currency.router import router as currency_router
from app.modules.brapi.api.dictionary.router import router as dictionary_router
from app.modules.brapi.api.fii.router import router as fii_router
from app.modules.brapi.api.funds.router import router as funds_router
from app.modules.brapi.api.future_options.router import router as future_options_router
from app.modules.brapi.api.futures.router import router as futures_router
from app.modules.brapi.api.inflation.router import router as inflation_router
from app.modules.brapi.api.macro.router import router as macro_router
from app.modules.brapi.api.prime_rate.router import router as prime_rate_router
from app.modules.brapi.api.options.router import router as options_router
from app.modules.brapi.api.stocks.router import router as stocks_router
from app.modules.brapi.api.treasury.router import router as treasury_router
from app.modules.brapi.api.tickers.router import router as tickers_router
from app.modules.brapi.api.account.router import router as account_router
from app.modules.users.views import current_superuser
from fastapi import APIRouter, Depends

router = APIRouter(prefix='/brapi/v2', dependencies=[Depends(current_superuser)])

router.include_router(crypto_router)
router.include_router(currency_router)
router.include_router(dictionary_router)
router.include_router(fii_router)
router.include_router(funds_router)
router.include_router(future_options_router)
router.include_router(futures_router)
router.include_router(inflation_router)
router.include_router(macro_router)
router.include_router(prime_rate_router)
router.include_router(options_router)
router.include_router(stocks_router)
router.include_router(treasury_router)
router.include_router(tickers_router)
router.include_router(account_router)

__all__ = ['router']
