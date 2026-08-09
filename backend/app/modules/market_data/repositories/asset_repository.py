from sqlalchemy import select, text, update

from app.modules.market_data.domain.asset_visit import AssetVisit
from app.modules.market_data.domain.assets import Asset
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
    DataIngestionType,
)


class AssetRepository(SQLAlchemyRepository):
    def __init__(self, session):
        super().__init__(session)

    async def get_by_ids(self, asset_ids: list[int]) -> list[Asset]:
        if not asset_ids:
            return []
        result = await self.session.execute(select(Asset).where(Asset.id.in_(asset_ids)))
        return list(result.scalars().all())

    async def record_asset_visit(self, user_id: int, asset_id: int) -> None:
        """Count one more visit, creating the row on the first one."""
        await self.session.execute(
            text("""
                INSERT INTO market_data.asset_visit (user_id, asset_id, visit_count, last_visited_at)
                VALUES (:user_id, :asset_id, 1, now())
                ON CONFLICT (user_id, asset_id)
                DO UPDATE SET
                    visit_count = market_data.asset_visit.visit_count + 1,
                    last_visited_at = now()
            """),
            {'user_id': user_id, 'asset_id': asset_id},
        )

    async def get_most_visited_assets(self, user_id: int, limit: int) -> list[tuple]:
        """The user's most opened assets, most visited first."""
        result = await self.session.execute(
            select(Asset, AssetVisit.visit_count, AssetVisit.last_visited_at)
            .join(AssetVisit, AssetVisit.asset_id == Asset.id)
            .where(AssetVisit.user_id == user_id)
            .order_by(AssetVisit.visit_count.desc(), AssetVisit.last_visited_at.desc())
            .limit(limit)
        )
        return list(result.all())

    async def detach_ingestion_attempts(self, asset_id: int) -> None:
        quote_execution_ids = select(DataIngestionExecution.id).where(
            DataIngestionExecution.ingestion_type == DataIngestionType.QUOTE.value
        )
        await self.session.execute(
            update(DataIngestionAttempt)
            .where(
                DataIngestionAttempt.item_id == asset_id,
                DataIngestionAttempt.execution_id.in_(quote_execution_ids),
            )
            .values(item_id=None)
        )

    async def get_by_tickers(
        self,
        tickers: list[str],
        asset_type_id: int,
    ) -> list[Asset]:
        if not tickers:
            return []
        result = await self.session.execute(
            select(Asset).where(
                Asset.ticker.in_(tickers),
                Asset.asset_type_id == asset_type_id,
            )
        )
        return list(result.scalars().all())
