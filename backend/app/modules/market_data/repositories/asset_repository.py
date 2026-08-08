from sqlalchemy import func, select, update

from app.modules.market_data.domain.assets import Asset
from app.modules.portfolio.domain.entities import (
    CustomCategoryAssignment,
    Dividend,
    Position,
    Transaction,
)
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

    async def get_portfolio_reference_counts(self, asset_id: int) -> dict[str, int]:
        reference_models = {
            'transactions': Transaction,
            'positions': Position,
            'dividends': Dividend,
            'category_assignments': CustomCategoryAssignment,
        }
        references: dict[str, int] = {}
        for name, model in reference_models.items():
            count = await self.session.scalar(
                select(func.count()).select_from(model).where(model.asset_id == asset_id)
            )
            if count:
                references[name] = int(count)
        return references

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
