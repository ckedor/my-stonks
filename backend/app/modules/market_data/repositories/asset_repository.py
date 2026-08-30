from sqlalchemy import select, text, update

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.asset_visit import AssetVisit
from app.modules.market_data.domain.assets import Asset, Exchange
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
    DataIngestionType,
)
from app.modules.market_data.domain.market_scope import B3_TICKER_PATTERN


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

    async def get_most_visited_assets(
        self,
        user_id: int,
        limit: int,
        asset_type_id: int | None = None,
        asset_ids: list[int] | None = None,
        brazilian: bool | None = None,
    ) -> list[tuple]:
        """The user's opened assets, most visited first.

        O critério é o hábito, e não a última aba aberta: a prateleira é o
        atalho para o que a pessoa mais volta a ver. A última visita entra só
        como desempate.

        `brazilian` recorta a prateleira pelo lado da fronteira que a tela
        mostra: ETF da B3 e ETF americano têm o mesmo tipo de ativo, e sem esse
        corte a tela de um mostrava os dois."""
        if asset_ids is not None and not asset_ids:
            return []

        statement = (
            select(Asset, AssetVisit.visit_count, AssetVisit.last_visited_at)
            .join(AssetVisit, AssetVisit.asset_id == Asset.id)
            .where(AssetVisit.user_id == user_id)
            .order_by(
                AssetVisit.visit_count.desc(),
                AssetVisit.last_visited_at.desc().nulls_last(),
            )
            .limit(limit)
        )
        if asset_type_id is not None:
            statement = statement.where(Asset.asset_type_id == asset_type_id)
        if asset_ids is not None:
            statement = statement.where(Asset.id.in_(asset_ids))
        if brazilian is not None:
            condition = self._b3_condition()
            statement = statement.where(condition if brazilian else ~condition)
        result = await self.session.execute(statement)
        return list(result.all())

    @staticmethod
    def _b3_condition():
        """O papel é da B3 — pela bolsa quando ela existe, pelo ticker quando não.

        O cadastro tem `exchange_id` nulo em quase todo ETF americano e em
        alguns da B3, então a bolsa sozinha não separa os dois lados. O formato
        do ticker separa: ver `domain.market_scope`.
        """
        b3 = select(Exchange.id).where(Exchange.code == EXCHANGE.B3.value).scalar_subquery()
        return (Asset.exchange_id == b3) | (
            Asset.exchange_id.is_(None) & Asset.ticker.op('~')(B3_TICKER_PATTERN)
        )

    async def get_registered_by_market(
        self,
        asset_type_id: int,
        *,
        brazilian: bool,
    ) -> list[Asset]:
        """Ativos cadastrados de uma classe, de um lado só da fronteira.

        Fora da B3 não há catálogo de provedor para folhear: o universo é o que
        já está no cadastro, e é dele que a tela de mercado americana é feita.
        """
        condition = self._b3_condition()
        statement = (
            select(Asset)
            .where(Asset.asset_type_id == asset_type_id)
            .where(condition if brazilian else ~condition)
            .order_by(Asset.ticker)
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

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
