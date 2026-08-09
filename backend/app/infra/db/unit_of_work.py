from collections.abc import Callable
from types import TracebackType

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.infra.db import bootstrap as _db_bootstrap  # noqa: F401
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.session import AsyncSessionLocal
from app.modules.market_data.repositories.asset_repository import AssetRepository
from app.modules.market_data.repositories.ingestion_repository import DataIngestionRepository
from app.modules.market_data.repositories.market_data_repository import MarketDataRepository
from app.modules.market_data.repositories.quote_repository import QuoteRepository
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository


class UnitOfWork:
    """The persistence entry point for application services.

    Entering opens the session scope and exposes the repositories. Reads just
    use them and leave. Writes call ``commit()`` before leaving; anything not
    committed is rolled back on exit.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    ) -> None:
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> 'UnitOfWork':
        if self._session is not None:
            raise RuntimeError('UnitOfWork is already active')

        self._session = self._session_factory()
        self.repository = SQLAlchemyRepository(self._session)
        self.assets = AssetRepository(self._session)
        self.market_data = MarketDataRepository(self._session)
        self.quotes = QuoteRepository(self._session)
        self.ingestions = DataIngestionRepository(self._session)
        self.portfolios = PortfolioRepository(self._session)
        return self

    async def commit(self) -> None:
        await self._session.commit()

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._session is None:
            return

        try:
            # Only roll back explicitly on the error path: ``rollback()`` expires
            # every instance in the identity map, and services hand loaded ORM
            # objects back to their callers. ``close()`` already discards any
            # uncommitted work at the connection level without expiring them.
            if exc_type is not None:
                await self._session.rollback()
        finally:
            await self._session.close()
            self._session = None


def get_uow() -> UnitOfWork:
    """FastAPI dependency that returns a fresh, unopened unit of work."""
    return UnitOfWork()


def get_uow_factory() -> Callable[[], UnitOfWork]:
    """For services that need several independent transactions, such as
    concurrent ingestion fan-out. A single UnitOfWork cannot be entered twice."""
    return UnitOfWork
