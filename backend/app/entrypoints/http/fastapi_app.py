# app/entrypoints/http/app.py

from contextlib import asynccontextmanager

from app.config.logger import logger
from app.config.settings import settings
from app.core.exceptions import (
    AlreadyExistsError,
    AppError,
    BusinessRuleError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from app.entrypoints.http.router import router as main_router
from app.infra.exceptions import (
    CacheError,
    DatabaseError,
    InfraError,
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
    IntegrationTimeout,
    IntegrationUnavailable,
)
from app.modules.users.views import setup_user_views
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

_STATUS_MAP: dict[type[AppError], int] = {
    NotFoundError: 404,
    PermissionDeniedError: 403,
    AlreadyExistsError: 409,
    ValidationError: 422,
    BusinessRuleError: 422,
    IntegrationTimeout: 504,
    IntegrationRateLimited: 429,
    IntegrationUnavailable: 503,
    IntegrationBadResponse: 502,
    IntegrationError: 502,
    DatabaseError: 500,
    CacheError: 500,
    InfraError: 500,
    AppError: 500,
}


def _status_for(exc: AppError) -> int:
    for cls in type(exc).__mro__:
        if cls in _STATUS_MAP:
            return _STATUS_MAP[cls]
    return 500


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        status = _status_for(exc)
        extra = {'path': request.url.path, 'context': exc.context}
        if status >= 500:
            logger.exception('Server error [%s %d]: %s', type(exc).__name__, status, exc, extra=extra)
        else:
            logger.warning('%s [%d]: %s', type(exc).__name__, status, exc, extra=extra)
        return JSONResponse(
            status_code=status,
            content={'error': type(exc).__name__, 'message': str(exc)},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception('Unhandled exception on %s', request.url.path)
        return JSONResponse(
            status_code=500,
            content={'error': 'InternalServerError', 'message': 'Internal server error'},
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.entrypoints.worker.task_runner import run_task
    from app.modules.market_data.tasks.consolidate_indexes_history import (
        consolidate_indexes_history,
    )

    logger.info("🚀 Disparando consolidate_indexes_history no startup")
    run_task(consolidate_indexes_history)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title='My Stonks API',
        description='API for portfolio consolidation',
        version='1.0.0',
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    app.add_middleware(SessionMiddleware, secret_key=settings.JWT_SECRET)

    setup_user_views(app)
    
    app.include_router(main_router)

    register_exception_handlers(app)
        
    return app
