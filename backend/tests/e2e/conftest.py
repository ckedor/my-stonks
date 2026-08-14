"""Harness for tests that enter through HTTP against a real database.

Three things shape this file.

**One seam, not twelve.** The previous harness reached into the application with
a `patch` per module path — seven for Redis, five for Celery — so the refactor
that moved those files broke every end-to-end test at once. Here the database is
swapped in a single place: `AsyncSessionLocal.configure`. That matters because
`app/composition/` builds a bare `UnitOfWork()` in nine places, which means
overriding the `get_uow` dependency alone would leave those pointing at the
development database.

**Rollback, not truncate.** Each test runs inside one connection with an open
transaction, and the sessions join it with `join_transaction_mode='create_savepoint'`.
The `commit()` the code under test calls is real as far as it can see, but it
commits a SAVEPOINT and never escapes the outer transaction, which is discarded
at teardown. Nothing is deleted between tests, so no hand-kept list of tables to
preserve can drift out of date, and the reference data seeded by the migrations
is loaded once.

**Real Postgres, real Redis.** Both come from `backend/docker-compose.yml`
(`db_test` on 5434, `redis`), so the schemas, the JSONB columns and the cache
behave as they do in production. See plan.md for why an in-memory database was
ruled out.
"""

import os

# Must precede any application import: settings reads .env at module import and
# only reloads from .env.test when this is already set.
os.environ['ENVIRONMENT'] = 'testing'

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine

from app.config.settings import settings

# Imported here rather than inside the fixture on purpose. Pulling in the whole
# router tree is slow enough that doing it while a test's asyncpg connection is
# already open breaks that connection, and the symptom — "got Future attached to
# a different loop" — points nowhere near the import that caused it.
from app.entrypoints.http.fastapi_app import create_app
from app.infra.db.session import AsyncSessionLocal
from app.modules.users.domain import User
from app.modules.users.views import current_active_user, current_superuser

pytestmark = pytest.mark.e2e

SEED_EMAIL = 'seed@user.com'


def _async_url() -> str:
    return settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')


@pytest.fixture(scope='session')
def anyio_backend():
    return 'asyncio'


def _database_is_reachable() -> bool:
    from sqlalchemy import create_engine

    engine = create_engine(settings.DATABASE_URL, connect_args={'connect_timeout': 2})
    try:
        with engine.connect():
            return True
    except Exception:
        return False
    finally:
        engine.dispose()


@pytest.fixture(scope='session', autouse=True)
def require_database():
    """Skip this layer instead of erupting when the containers are not up.

    The whole suite runs on every commit, and someone without `db_test` running
    should see a clear skip rather than sixty errors that look like broken code.
    Bring it up with `task db_test_up`.
    """
    if not _database_is_reachable():
        pytest.skip(
            'Banco de teste indisponível em '
            f'{settings.DATABASE_URL.rsplit("@", 1)[-1]}. Suba com: task db_test_up',
            allow_module_level=True,
        )


@pytest.fixture(scope='session')
def seed_user_id(require_database):
    """Migrate once, and make sure the shared user exists. Returns its id.

    Deliberately synchronous. An async session-scoped fixture would build its
    connection pool on one event loop while each test runs on another, and
    asyncpg refuses to be used across loops — the failure reads
    `got Future attached to a different loop` and looks nothing like its cause.
    Doing the one-off setup over a sync connection sidesteps the question.

    Running the real migrations rather than `create_all` exercises the
    migrations themselves, and is what creates the four Postgres schemas and
    seeds the reference rows every test leans on.

    The user is committed on purpose: it is reference data, in the same class as
    those asset types, and the identity the auth override hands to the routes.
    """
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text

    config = Config('alembic.ini')
    config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)
    # alembic/env.py calls fileConfig() when it has a config file, and that
    # disables every logger already defined — including the application's, which
    # then silently captures nothing for the rest of the run. Clearing the name
    # skips the logging setup and leaves the migrations themselves untouched.
    config.config_file_name = None
    command.upgrade(config, 'head')

    sync_engine = create_engine(settings.DATABASE_URL)
    try:
        with sync_engine.begin() as conn:
            user_id = conn.scalar(
                text('SELECT id FROM public."user" WHERE email = :email'),
                {'email': SEED_EMAIL},
            )
            if user_id is None:
                user_id = conn.scalar(
                    text(
                        'INSERT INTO public."user" '
                        '(username, email, hashed_password, is_active, is_superuser, is_verified) '
                        "VALUES ('seed', :email, 'not-a-real-hash', true, true, true) "
                        'RETURNING id'
                    ),
                    {'email': SEED_EMAIL},
                )
        return user_id
    finally:
        sync_engine.dispose()


@pytest_asyncio.fixture
async def engine(seed_user_id):
    """One engine per test, so its pool always belongs to the running loop."""
    engine = create_async_engine(_async_url())
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def connection(engine):
    """The transaction every session in one test joins, rolled back at the end."""
    async with engine.connect() as conn:
        transaction = await conn.begin()

        AsyncSessionLocal.configure(bind=conn, join_transaction_mode='create_savepoint')
        try:
            yield conn
        finally:
            AsyncSessionLocal.configure(bind=engine, join_transaction_mode='conditional_savepoint')
            await transaction.rollback()


@pytest_asyncio.fixture
async def db(connection):
    """A session for asserting on the database directly, inside the test transaction."""
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture(autouse=True)
def no_celery():
    """Keep task dispatch from needing a broker.

    Patched at the framework level — `Task.delay` and the app's `send_task` —
    rather than at each router that imports `run_task`, which is what made the
    old harness break whenever a file moved.
    """
    with (
        patch('celery.app.task.Task.delay') as delay,
        patch('app.entrypoints.worker.celery_app.celery_app.send_task') as send_task,
    ):
        yield {'delay': delay, 'send_task': send_task}


@pytest_asyncio.fixture(autouse=True)
async def clean_cache():
    """Empty Redis around each test so a cached read cannot leak between them."""
    from app.infra.redis.redis_service import RedisService

    service = RedisService()
    await service.client.flushdb()
    yield
    await service.client.flushdb()
    await service.client.aclose()


@pytest.fixture
def seed_user(seed_user_id):
    return User(
        id=seed_user_id,
        username='seed',
        email=SEED_EMAIL,
        hashed_password='not-a-real-hash',
        is_active=True,
        is_superuser=True,
        is_verified=True,
    )


@pytest_asyncio.fixture
async def client(connection, seed_user):
    """An HTTP client onto the real application, authenticated as the seed user.

    Only authentication is overridden. Routing, dependencies, serialization and
    the composition root are the production ones, which is the point of entering
    here rather than calling a service.
    """
    app = create_app()
    app.dependency_overrides[current_active_user] = lambda: seed_user
    app.dependency_overrides[current_superuser] = lambda: seed_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url='http://test') as http:
        yield http

    app.dependency_overrides.clear()


@pytest.fixture
def anything():
    """Placeholder used by assertions that only care a value is present."""
    return AsyncMock()


@pytest_asyncio.fixture
async def factory(db, seed_user_id):
    """Row builders bound to this test's session. See tests/factories.py."""
    from tests.factories import Factory

    return Factory(db, seed_user_id)


@pytest_asyncio.fixture(autouse=True)
async def seed_rate(factory):
    """A USD/BRL rate old enough to cover every date a test invents.

    Positions, transactions and dividends are all stored in both currencies, so
    without one of these the write fails on a lookup that has nothing to do with
    what the test is checking. Cheaper to always have one than to remember.
    """
    await factory.usd_brl_rate()
