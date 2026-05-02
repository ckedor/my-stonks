# app/modules/market_data/repositories/market_data_repository.py
"""
Market data repository - handles database operations for indexes and their history.
"""

from app.infra.db.models.market_data import Index, IndexHistory
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from sqlalchemy import select


class MarketDataRepository(SQLAlchemyRepository):
    """Repository for market data operations"""

    async def get_index_history(
        self,
        start_date: str = None,
        index_id: int = None,
    ) -> list[dict]:
        """Return raw index history rows joined with index metadata.

        Each row is a mapping with keys: ``date``, ``value``, ``index_symbol``,
        ``index_name``. Conversion to DataFrame is the caller's responsibility.
        """
        stmt = select(
            IndexHistory.date,
            IndexHistory.close.label('value'),
            Index.symbol.label('index_symbol'),
            Index.short_name.label('index_name'),
        ).join(Index, IndexHistory.index_id == Index.id)

        if start_date:
            stmt = stmt.where(IndexHistory.date >= start_date)
        if index_id:
            stmt = stmt.where(Index.id == index_id)

        result = await self.session.execute(stmt)
        return result.mappings().all()
