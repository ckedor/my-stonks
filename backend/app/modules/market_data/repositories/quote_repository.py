from datetime import date

from sqlalchemy import delete, func, select

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.quote import Quote


class QuoteRepository(SQLAlchemyRepository):
    async def get_source_quotes(
        self, asset_id: int, *, source: str, start_date: date, end_date: date
    ) -> list[Quote]:
        result = await self.session.execute(
            select(Quote).where(
                Quote.asset_id == asset_id,
                Quote.source == source,
                Quote.date >= start_date,
                Quote.date <= end_date,
            )
        )
        return list(result.scalars())

    async def delete_source_quotes(self, asset_id: int, *, source: str, dates: set[date]) -> None:
        if dates:
            await self.session.execute(
                delete(Quote).where(
                    Quote.asset_id == asset_id, Quote.source == source, Quote.date.in_(dates)
                )
            )

    async def get_quotes(
        self,
        asset_ids: list[int],
        start_date: date | None = None,
    ) -> list[Quote]:
        if not asset_ids:
            return []
        stmt = (
            select(Quote).where(Quote.asset_id.in_(asset_ids)).order_by(Quote.asset_id, Quote.date)
        )
        if start_date is not None:
            stmt = stmt.where(Quote.date >= start_date)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_quote_on_or_before(self, asset_id: int, on: date) -> Quote | None:
        """The last quote dated on or before ``on``: the price in effect that day.

        A series filed weekly or monthly has no quote on most days, so a position
        opened between two filings is priced by the one before it.
        """
        result = await self.session.execute(
            select(Quote)
            .where(Quote.asset_id == asset_id, Quote.date <= on, Quote.close.is_not(None))
            .order_by(Quote.date.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def get_latest_quote_dates(self, asset_ids: list[int]) -> dict[int, date]:
        if not asset_ids:
            return {}
        result = await self.session.execute(
            select(
                Quote.asset_id,
                func.max(Quote.date).label('latest_date'),
            )
            .where(Quote.asset_id.in_(asset_ids))
            .group_by(Quote.asset_id)
        )
        return {row.asset_id: row.latest_date for row in result if row.latest_date is not None}

    async def upsert_quotes(self, quotes: list[dict]) -> None:
        if not quotes:
            return
        await self.upsert_bulk(
            Quote,
            quotes,
            unique_columns=['asset_id', 'date'],
        )
