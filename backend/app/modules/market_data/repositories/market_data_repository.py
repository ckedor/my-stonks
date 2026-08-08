# app/modules/market_data/repositories/market_data_repository.py
"""Persistence queries for market-data series and exchange rates."""

from datetime import date

from sqlalchemy import desc, func, select

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesHistory,
)
from app.modules.market_data.domain.usd_brl import UsdBrlHistory

SERIES_HISTORY_UPSERT_COLUMNS = (
    'series_id',
    'date',
    'open',
    'close',
    'high',
    'low',
    'source',
)


class MarketDataRepository(SQLAlchemyRepository):
    """Repository for market data operations"""

    async def get_series_history(
        self,
        start_date: str = None,
        index_id: int = None,
    ) -> list[dict]:
        """Return raw index history rows joined with index metadata.

        Each row is a mapping with keys: ``date``, ``value``, ``index_symbol``,
        ``index_name``. Conversion to DataFrame is the caller's responsibility.
        """
        stmt = select(
            MarketDataSeriesHistory.date,
            MarketDataSeriesHistory.close.label('value'),
            MarketDataSeries.symbol.label('index_symbol'),
            MarketDataSeries.short_name.label('index_name'),
        ).join(
            MarketDataSeries,
            MarketDataSeriesHistory.series_id == MarketDataSeries.id,
        )

        if start_date:
            stmt = stmt.where(MarketDataSeriesHistory.date >= start_date)
        if index_id:
            stmt = stmt.where(MarketDataSeries.id == index_id)

        result = await self.session.execute(stmt)
        return result.mappings().all()

    async def get_index_history(self, start_date: str = None, index_id: int = None):
        """Compatibility alias for existing portfolio read flows."""
        return await self.get_series_history(start_date, index_id=index_id)

    async def get_latest_series_dates(self, series_ids: list[int]) -> dict[int, date]:
        if not series_ids:
            return {}
        result = await self.session.execute(
            select(
                MarketDataSeriesHistory.series_id,
                func.max(MarketDataSeriesHistory.date).label('latest_date'),
            )
            .where(MarketDataSeriesHistory.series_id.in_(series_ids))
            .group_by(MarketDataSeriesHistory.series_id)
        )
        return {row.series_id: row.latest_date for row in result}

    async def get_usd_brl_history(self, start_date: date | None = None):
        stmt = select(UsdBrlHistory).order_by(UsdBrlHistory.date)
        if start_date is not None:
            stmt = stmt.where(UsdBrlHistory.date >= start_date)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_usd_brl_date(self) -> date | None:
        return await self.session.scalar(select(func.max(UsdBrlHistory.date)))

    async def get_usd_brl_rate_on_or_before(self, target_date: date) -> UsdBrlHistory | None:
        result = await self.session.execute(
            select(UsdBrlHistory)
            .where(UsdBrlHistory.date <= target_date)
            .order_by(desc(UsdBrlHistory.date))
            .limit(1)
        )
        return result.scalar_one_or_none()
