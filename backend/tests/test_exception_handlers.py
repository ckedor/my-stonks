import pytest
import pytest_asyncio
from app.core.exceptions import (
    AlreadyExistsError,
    BusinessRuleError,
    NotFoundError,
    ValidationError,
)
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationTimeout,
)
from httpx import ASGITransport, AsyncClient


def _build_app_with_error_routes():
    """Create a minimal FastAPI app with routes that raise specific exceptions."""
    from app.entrypoints.http.fastapi_app import register_exception_handlers
    from fastapi import FastAPI

    app = FastAPI()
    register_exception_handlers(app)

    @app.get('/raise-not-found')
    async def raise_not_found():
        raise NotFoundError('Thing not found')

    @app.get('/raise-already-exists')
    async def raise_already_exists():
        raise AlreadyExistsError('Already exists')

    @app.get('/raise-validation')
    async def raise_validation():
        raise ValidationError('Bad input')

    @app.get('/raise-business-rule')
    async def raise_business_rule():
        raise BusinessRuleError('Rule violated')

    @app.get('/raise-integration-timeout')
    async def raise_integration_timeout():
        raise IntegrationTimeout(provider='test')

    @app.get('/raise-integration-bad-response')
    async def raise_integration_bad_response():
        raise IntegrationBadResponse(provider='test')

    @app.get('/raise-integration-error')
    async def raise_integration_error():
        raise IntegrationError(provider='test', status_code=503, retryable=True)

    @app.get('/raise-unhandled')
    async def raise_unhandled():
        raise RuntimeError('something unexpected')

    return app


@pytest_asyncio.fixture
async def error_client():
    app = _build_app_with_error_routes()
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url='http://test') as ac:
        yield ac


@pytest.mark.asyncio
async def test_not_found_returns_404(error_client):
    resp = await error_client.get('/raise-not-found')
    assert resp.status_code == 404
    body = resp.json()
    assert body['error'] == 'NotFoundError'
    assert body['message'] == 'Thing not found'


@pytest.mark.asyncio
async def test_already_exists_returns_409(error_client):
    resp = await error_client.get('/raise-already-exists')
    assert resp.status_code == 409
    assert resp.json()['error'] == 'AlreadyExistsError'


@pytest.mark.asyncio
async def test_validation_returns_422(error_client):
    resp = await error_client.get('/raise-validation')
    assert resp.status_code == 422
    assert resp.json()['error'] == 'ValidationError'


@pytest.mark.asyncio
async def test_business_rule_returns_422(error_client):
    resp = await error_client.get('/raise-business-rule')
    assert resp.status_code == 422
    assert resp.json()['error'] == 'BusinessRuleError'


@pytest.mark.asyncio
async def test_integration_timeout_returns_504(error_client):
    resp = await error_client.get('/raise-integration-timeout')
    assert resp.status_code == 504
    assert resp.json()['error'] == 'IntegrationTimeout'


@pytest.mark.asyncio
async def test_integration_bad_response_returns_502(error_client):
    resp = await error_client.get('/raise-integration-bad-response')
    assert resp.status_code == 502
    assert resp.json()['error'] == 'IntegrationBadResponse'


@pytest.mark.asyncio
async def test_integration_error_returns_502(error_client):
    resp = await error_client.get('/raise-integration-error')
    assert resp.status_code == 502
    assert resp.json()['error'] == 'IntegrationError'


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500(error_client):
    resp = await error_client.get('/raise-unhandled')
    assert resp.status_code == 500
    assert resp.json()['error'] == 'InternalServerError'
