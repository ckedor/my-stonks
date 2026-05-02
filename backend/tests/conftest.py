import os
from unittest.mock import AsyncMock, patch

# Must set ENVIRONMENT before any app import
os.environ['ENVIRONMENT'] = 'testing'

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from app.infra.db.base import Base
from app.modules.users.models import User
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Database URLs
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.getenv(
    'DATABASE_URL', 'postgresql://admin:roots123@localhost:5434/my-stonks-api-db-test'
)
ASYNC_TEST_DATABASE_URL = TEST_DATABASE_URL.replace(
    'postgresql://', 'postgresql+asyncpg://'
)

# Sync engine – used for migrations, seeding, truncation & direct DB assertions
sync_engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=sync_engine)

# Async engine – used by the app under test (overrides get_session)
test_async_engine = create_async_engine(ASYNC_TEST_DATABASE_URL, echo=False)
TestAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine, expire_on_commit=False
)

# ---------------------------------------------------------------------------
# Reference tables that should NOT be truncated between tests
# ---------------------------------------------------------------------------
PRESERVED_TABLES = {
    'currency',
    'asset_type',
    'asset_class',
    'etf_segment',
    'fii_segment',
    'fii_type',
    'fixed_income_type',
    'treasury_bond_type',
    'treasury_bond',
    'user',
    'exchange',
    'index',
    'configuration_name',
}


# ---------------------------------------------------------------------------
# Migrations & seeding (once per test session)
# ---------------------------------------------------------------------------
def run_migrations():
    config = Config('alembic.ini')
    config.set_main_option('sqlalchemy.url', TEST_DATABASE_URL)
    command.upgrade(config, 'head')


@pytest.fixture(scope='session', autouse=True)
def setup_database():
    run_migrations()
    db = TestingSessionLocal()

    existing_user = db.query(User).filter_by(email='seed@user.com').first()
    if not existing_user:
        user = User(
            username='admin',
            email='seed@user.com',
            hashed_password='123',
            is_superuser=True,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()

    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Per-test cleanup – truncates non-reference tables
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def truncate_tables():
    yield
    with sync_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name not in PRESERVED_TABLES:
                conn.execute(table.delete())


# ---------------------------------------------------------------------------
# Sync DB session for direct assertions in tests
# ---------------------------------------------------------------------------
@pytest.fixture
def db():
    session = TestingSessionLocal()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# Override the app's async get_session to point at the test DB
# ---------------------------------------------------------------------------
async def _test_get_session():
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            if session.in_transaction():
                await session.rollback()


# ---------------------------------------------------------------------------
# Mock Redis (services instantiate RedisService directly)
# ---------------------------------------------------------------------------
_REDIS_PATCHES = [
    'app.modules.market_data.service.asset_service.RedisService',
    'app.modules.market_data.service.market_data_service.RedisService',
    'app.modules.portfolio.service.portfolio_base_service.RedisService',
    'app.modules.portfolio.service.portfolio_position_service.RedisService',
    'app.modules.portfolio.tasks.set_patrimony_evolution_cache.RedisService',
    'app.modules.portfolio.tasks.set_portfolio_returns_cache.RedisService',
    'app.modules.market_data.tasks.set_indexes_history_cache.RedisService',
]


@pytest.fixture(autouse=True)
def mock_redis():
    """Replace all RedisService usages with an in-memory mock."""
    patchers = []
    for target in _REDIS_PATCHES:
        p = patch(target)
        mock_cls = p.start()
        instance = mock_cls.return_value
        instance.get_json = AsyncMock(return_value=None)
        instance.set_json = AsyncMock()
        instance.delete = AsyncMock()
        patchers.append(p)
    yield
    for p in patchers:
        p.stop()


# ---------------------------------------------------------------------------
# Mock Celery run_task (avoids broker dependency)
# ---------------------------------------------------------------------------
_RUN_TASK_PATCHES = [
    'app.modules.market_data.api.index.router.run_task',
    'app.modules.portfolio.api.category.router.run_task',
    'app.modules.portfolio.api.transaction.router.run_task',
    'app.modules.portfolio.api.position_consolidator.router.run_task',
    'app.modules.portfolio.service.portfolio_transaction_service.run_task',
]


@pytest.fixture(autouse=True)
def mock_run_task():
    """Make run_task a no-op so tests don't need a Celery broker."""
    patchers = [patch(t, new=lambda *a, **kw: None) for t in _RUN_TASK_PATCHES]
    for p in patchers:
        p.start()
    yield
    for p in patchers:
        p.stop()


# ---------------------------------------------------------------------------
# Async HTTP test client (full E2E through FastAPI)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client():
    from app.infra.db.session import get_session
    from app.main import app
    from app.modules.users.views import current_active_user, current_superuser

    # Point the app at the test database
    app.dependency_overrides[get_session] = _test_get_session

    # Bypass JWT authentication
    fake_user = User(
        id=1,
        email='seed@user.com',
        username='admin',
        hashed_password='123',
        is_superuser=True,
        is_active=True,
        is_verified=True,
    )
    app.dependency_overrides[current_active_user] = lambda: fake_user
    app.dependency_overrides[current_superuser] = lambda: fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as ac:
        yield ac

    app.dependency_overrides.clear()
