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
    """Transaction boundary for database writes."""

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

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._session is None:
            return

        try:
            if exc_type is None:
                try:
                    await self._session.commit()
                except Exception:
                    await self._session.rollback()
                    raise
            else:
                await self._session.rollback()
        finally:
            await self._session.close()
            self._session = None


def get_uow() -> UnitOfWork:
    """FastAPI dependency that returns a fresh, unopened unit of work."""
    return UnitOfWork()


def get_uow_factory() -> Callable[[], UnitOfWork]:
    """FastAPI dependency for services with multiple transaction boundaries."""
    return UnitOfWork
