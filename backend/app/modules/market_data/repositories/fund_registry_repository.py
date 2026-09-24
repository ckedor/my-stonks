from collections.abc import Sequence

from sqlalchemy import func, or_, select, text, update
from sqlalchemy.orm import selectinload

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.assets import Asset, Institution, InvestmentFund
from app.modules.market_data.domain.fund_registry import (
    FundRegistry,
    FundRegistryClass,
    FundRegistrySubclass,
    FundShareSeries,
    FundShareSeriesAlias,
)

#: Rows per statement when writing the registry. ~90k funds in a handful of
#: round trips, without building one statement the size of the file.
REGISTRY_BATCH_SIZE = 2000

CNPJ_PREFIX_DIGITS = 8
#: Um CNPJ completo. Documento mais curto é identidade parcial e não vira entidade.
CNPJ_DIGITS = 14

TERMS_COLUMNS = (
    'admin_fee',
    'performance_fee',
    'performance_benchmark',
    'minimum_investment',
    'conversion_days',
    'redemption_payment_days',
    'terms_date',
)


class FundRegistryRepository(SQLAlchemyRepository):
    async def upsert_funds(self, rows: Sequence[dict]) -> None:
        for start in range(0, len(rows), REGISTRY_BATCH_SIZE):
            await self.upsert_bulk(
                FundRegistry,
                list(rows[start : start + REGISTRY_BATCH_SIZE]),
                unique_columns=['registry_id'],
            )

    async def get_fund_ids_by_registry_id(self) -> dict[int, int]:
        result = await self.session.execute(select(FundRegistry.registry_id, FundRegistry.id))
        return dict(result.all())

    async def get_unlinked_administrators(self) -> list[dict]:
        """Administradores que o registro nomeia e que ainda não têm entidade.

        A ingestão semanal escreve o CNPJ e o nome como texto; aqui só se olha
        quem ficou sem vínculo. Um CNPJ que não tenha os 14 dígitos fica de
        fora: o CNPJ é a identidade da entidade, e um parcial criaria uma
        linha que nada consegue casar depois.
        """
        result = await self.session.execute(
            select(
                FundRegistry.administrator_cnpj,
                func.min(FundRegistry.administrator_name),
            )
            .where(FundRegistry.administrator_institution_id.is_(None))
            .where(FundRegistry.administrator_cnpj.is_not(None))
            .where(func.length(FundRegistry.administrator_cnpj) == CNPJ_DIGITS)
            .group_by(FundRegistry.administrator_cnpj)
        )
        return [{'cnpj': cnpj, 'name': (name or '').strip() or cnpj} for cnpj, name in result.all()]

    async def link_administrators(self) -> int:
        """Aponta cada fundo para a entidade cujo CNPJ ele já declarava."""
        result = await self.session.execute(
            update(FundRegistry)
            .where(FundRegistry.administrator_institution_id.is_(None))
            .where(FundRegistry.administrator_cnpj == Institution.cnpj)
            .values(administrator_institution_id=Institution.id)
        )
        return result.rowcount or 0

    async def upsert_classes(self, rows: Sequence[dict]) -> None:
        for start in range(0, len(rows), REGISTRY_BATCH_SIZE):
            await self.upsert_bulk(
                FundRegistryClass,
                list(rows[start : start + REGISTRY_BATCH_SIZE]),
                unique_columns=['registry_id'],
            )

    async def get_class_ids_by_registry_id(self) -> dict[int, int]:
        result = await self.session.execute(
            select(FundRegistryClass.registry_id, FundRegistryClass.id)
        )
        return dict(result.all())

    async def upsert_subclasses(self, rows: Sequence[dict]) -> None:
        for start in range(0, len(rows), REGISTRY_BATCH_SIZE):
            await self.upsert_bulk(
                FundRegistrySubclass,
                list(rows[start : start + REGISTRY_BATCH_SIZE]),
                unique_columns=['fund_registry_class_id', 'code'],
            )

    async def apply_terms(self, rows: Sequence[dict]) -> int:
        """Write terms onto every class with the row's CNPJ. Returns rows written.

        Terms are published per CNPJ, and a CNPJ that was re-registered appears
        on more than one class; all of them get the terms filed for it.
        """
        if not rows:
            return 0
        statement = text(
            'UPDATE asset.fund_registry_class SET '
            + ', '.join(f'{column} = :{column}' for column in TERMS_COLUMNS)
            + ' WHERE cnpj = :cnpj'
        )
        updated = 0
        for start in range(0, len(rows), REGISTRY_BATCH_SIZE):
            batch = [
                {key: self._persistable(value) for key, value in row.items()}
                for row in rows[start : start + REGISTRY_BATCH_SIZE]
            ]
            result = await self.session.execute(statement, batch)
            updated += max(result.rowcount or 0, 0)
        return updated

    async def search_classes(
        self,
        *,
        query: str | None,
        kind: str | None,
        status: str | None,
        limit: int,
    ) -> list[FundRegistryClass]:
        stmt = (
            select(FundRegistryClass)
            .join(FundRegistry, FundRegistry.id == FundRegistryClass.fund_registry_id)
            .order_by(FundRegistryClass.equity.desc().nulls_last(), FundRegistryClass.name)
            .limit(limit)
        )
        if query:
            digits_only = ''.join(char for char in query if char.isdigit())
            pattern = f'%{query.strip()}%'
            conditions = [
                FundRegistryClass.name.ilike(pattern),
                FundRegistry.name.ilike(pattern),
                FundRegistry.administrator_name.ilike(pattern),
                FundRegistry.manager_name.ilike(pattern),
            ]
            # Eight digits identify the company behind a CNPJ; fewer match names
            # that happen to contain numbers.
            if len(digits_only) >= CNPJ_PREFIX_DIGITS:
                conditions += [
                    FundRegistryClass.cnpj.startswith(digits_only),
                    FundRegistry.cnpj.startswith(digits_only),
                ]
            stmt = stmt.where(or_(*conditions))
        if kind:
            stmt = stmt.where(FundRegistry.kind == kind)
        if status:
            stmt = stmt.where(FundRegistryClass.status == status)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_fund(self, fund_id: int) -> FundRegistry | None:
        result = await self.session.execute(select(FundRegistry).where(FundRegistry.id == fund_id))
        return result.scalars().first()

    async def search_funds(
        self, *, query: str | None, kind: str | None, limit: int
    ) -> list[FundRegistry]:
        """Registered funds by name, CNPJ, administrator or manager.

        The counterpart of ``search_classes`` at the fund level, which is what a
        FII or an ETF links to. An ETF has no provider CNPJ to suggest from, so
        this is how it is found by hand.
        """
        stmt = select(FundRegistry).order_by(FundRegistry.name).limit(limit)
        if query:
            digits_only = ''.join(char for char in query if char.isdigit())
            pattern = f'%{query.strip()}%'
            conditions = [
                FundRegistry.name.ilike(pattern),
                FundRegistry.administrator_name.ilike(pattern),
                FundRegistry.manager_name.ilike(pattern),
            ]
            if len(digits_only) >= CNPJ_PREFIX_DIGITS:
                conditions.append(FundRegistry.cnpj.startswith(digits_only))
            stmt = stmt.where(or_(*conditions))
        if kind:
            stmt = stmt.where(FundRegistry.kind == kind)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_class(
        self, class_id: int, *, for_update: bool = False
    ) -> FundRegistryClass | None:
        statement = select(FundRegistryClass).where(FundRegistryClass.id == class_id)
        if for_update:
            statement = statement.with_for_update(of=FundRegistryClass)
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def list_subclasses(self, class_id: int) -> list[FundRegistrySubclass]:
        result = await self.session.execute(
            select(FundRegistrySubclass)
            .where(FundRegistrySubclass.fund_registry_class_id == class_id)
            .order_by(FundRegistrySubclass.name)
        )
        return list(result.scalars().all())

    async def get_subclass(self, subclass_id: int) -> FundRegistrySubclass | None:
        result = await self.session.execute(
            select(FundRegistrySubclass).where(FundRegistrySubclass.id == subclass_id)
        )
        return result.scalars().first()

    async def get_series(self, series_id: int) -> FundShareSeries | None:
        result = await self.session.execute(
            select(FundShareSeries).where(FundShareSeries.id == series_id)
        )
        return result.scalars().first()

    async def list_series(self, class_id: int) -> list[FundShareSeries]:
        result = await self.session.execute(
            select(FundShareSeries)
            .where(FundShareSeries.fund_registry_class_id == class_id)
            .order_by(FundShareSeries.id)
        )
        return list(result.scalars().all())

    async def list_aliases(self, class_ids: Sequence[int]) -> list[FundShareSeriesAlias]:
        if not class_ids:
            return []
        result = await self.session.execute(
            select(FundShareSeriesAlias)
            .where(FundShareSeriesAlias.fund_registry_class_id.in_(class_ids))
            .order_by(
                FundShareSeriesAlias.fund_registry_class_id,
                FundShareSeriesAlias.valid_from.nulls_first(),
                FundShareSeriesAlias.id,
            )
        )
        return list(result.scalars().all())

    async def find_priced_unit(
        self,
        *,
        class_id: int,
        subclass_id: int | None,
        series_id: int | None,
    ) -> InvestmentFund | None:
        stmt = select(InvestmentFund).where(InvestmentFund.fund_registry_class_id == class_id)
        stmt = stmt.where(
            func.coalesce(InvestmentFund.fund_registry_subclass_id, 0) == (subclass_id or 0),
            func.coalesce(InvestmentFund.fund_share_series_id, 0) == (series_id or 0),
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_funds(self, asset_ids: Sequence[int]) -> list[InvestmentFund]:
        """Investment-fund details with their priced unit, for these assets."""
        if not asset_ids:
            return []
        result = await self.session.execute(
            select(InvestmentFund)
            .where(InvestmentFund.asset_id.in_(asset_ids))
            .options(
                selectinload(InvestmentFund.asset).selectinload(Asset.asset_type),
                selectinload(InvestmentFund.registry_class),
                selectinload(InvestmentFund.registry_subclass),
                selectinload(InvestmentFund.share_series),
            )
        )
        return list(result.scalars().all())

    async def bump_selection_version(self, asset_ids: Sequence[int]) -> None:
        if not asset_ids:
            return
        await self.session.execute(
            update(InvestmentFund)
            .where(InvestmentFund.asset_id.in_(asset_ids))
            .values(selection_version=InvestmentFund.selection_version + 1)
            .execution_options(synchronize_session=False)
        )

    async def get_fund_link(self, asset_id: int, columns: Sequence[str]) -> dict | None:
        """Plain column values, not the entity: the caller replaces the row in the
        same session, and a loaded instance would collide with the new one."""
        table = InvestmentFund.__table__
        result = await self.session.execute(
            select(*(table.c[column] for column in columns)).where(table.c.asset_id == asset_id)
        )
        row = result.mappings().first()
        return dict(row) if row else None

    async def list_class_units(self, class_id: int) -> list[InvestmentFund]:
        result = await self.session.execute(
            select(InvestmentFund).where(InvestmentFund.fund_registry_class_id == class_id)
        )
        return list(result.scalars().all())

    async def find_funds_by_cnpj(self, cnpjs: Sequence[str]) -> list[FundRegistry]:
        """The registered funds carrying these CNPJs.

        Funds, not classes: a provider states a FII's fund CNPJ, and 539 of the
        539 FIIs it lists are found at that level against 448 by class, because
        many FIIs still have no class registered under RES 175.
        """
        if not cnpjs:
            return []
        result = await self.session.execute(
            select(FundRegistry).where(FundRegistry.cnpj.in_(list(cnpjs)))
        )
        return list(result.scalars().all())

    async def find_funds_by_legal_id(self, cnpjs: Sequence[str]) -> list[InvestmentFund]:
        """The fund assets whose own CNPJ is one of these.

        The CNPJ recorded on the asset, independent of the registry class it is
        linked to — which a fund registered by hand does not have, and a
        fund of funds may have pointing at its master.
        """
        if not cnpjs:
            return []
        result = await self.session.execute(
            select(InvestmentFund).where(InvestmentFund.legal_id.in_(list(cnpjs)))
        )
        return list(result.scalars().all())

    async def find_classes_by_cnpj(self, cnpjs: Sequence[str]) -> list[FundRegistryClass]:
        if not cnpjs:
            return []
        result = await self.session.execute(
            select(FundRegistryClass).where(FundRegistryClass.cnpj.in_(list(cnpjs)))
        )
        return list(result.scalars().all())

    async def get_series_asset_ids(self, series_id: int) -> list[int]:
        result = await self.session.execute(
            select(InvestmentFund.asset_id).where(InvestmentFund.fund_share_series_id == series_id)
        )
        return list(result.scalars().all())
