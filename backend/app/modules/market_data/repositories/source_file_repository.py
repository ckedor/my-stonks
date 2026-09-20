from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.fund_share_value import (
    FundShareValueCoverage,
    IngestionCheckpoint,
    SourceFile,
)


class SourceFileRepository(SQLAlchemyRepository):
    """File versions and what was applied from them. Never a file body."""

    async def get_files(self, keys: Sequence[tuple[str, str]]) -> dict[tuple[str, str], SourceFile]:
        if not keys:
            return {}
        result = await self.session.execute(
            select(SourceFile).where(tuple_(SourceFile.dataset, SourceFile.period).in_(list(keys)))
        )
        return {(row.dataset, row.period): row for row in result.scalars().all()}

    async def save_version(  # noqa: PLR0913
        self,
        *,
        dataset: str,
        period: str,
        etag: str | None,
        last_modified: datetime | None,
        size_bytes: int | None,
        content_version: str | None,
        fetched_at: datetime,
        applied_registry_version: str | None = None,
    ) -> int:
        values = {
            'dataset': dataset,
            'period': period,
            'etag': etag,
            'last_modified': last_modified,
            'size_bytes': size_bytes,
            'content_version': content_version,
            'fetched_at': fetched_at,
            'applied_registry_version': applied_registry_version,
        }
        table = SourceFile.__table__
        statement = (
            insert(table)
            .values(**values)
            .on_conflict_do_update(
                constraint='uq_source_file_dataset_period',
                set_={
                    key: value for key, value in values.items() if key not in ('dataset', 'period')
                },
            )
            .returning(table.c.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def ensure_file(self, *, dataset: str, period: str) -> int:
        """The id of a file row, creating an empty one on first sight.

        Coverage needs a file to point at before its validators are saved; the
        row carries no version until the body is fully processed.
        """
        table = SourceFile.__table__
        await self.session.execute(
            insert(table)
            .values(dataset=dataset, period=period)
            .on_conflict_do_nothing(constraint='uq_source_file_dataset_period')
        )
        result = await self.session.execute(
            select(SourceFile.id).where(SourceFile.dataset == dataset, SourceFile.period == period)
        )
        return result.scalar_one()

    async def get_coverage(
        self,
        *,
        asset_ids: Sequence[int],
        source_file_ids: Sequence[int] | None = None,
    ) -> list[FundShareValueCoverage]:
        if not asset_ids:
            return []
        stmt = select(FundShareValueCoverage).where(
            FundShareValueCoverage.asset_id.in_(list(asset_ids))
        )
        if source_file_ids is not None:
            stmt = stmt.where(FundShareValueCoverage.source_file_id.in_(list(source_file_ids)))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def add_coverage(self, coverage: FundShareValueCoverage) -> None:
        table = FundShareValueCoverage.__table__
        await self.session.execute(
            insert(table)
            .values(
                source_file_id=coverage.source_file_id,
                asset_id=coverage.asset_id,
                content_version=coverage.content_version,
                selection_version=coverage.selection_version,
                covered_from=coverage.covered_from,
                covered_to=coverage.covered_to,
                matched_rows=coverage.matched_rows,
            )
            .on_conflict_do_update(
                constraint='uq_fund_share_value_coverage_application',
                set_={'matched_rows': coverage.matched_rows, 'processed_at': datetime.now()},
            )
        )

    async def get_checkpoint(self, name: str) -> IngestionCheckpoint | None:
        result = await self.session.execute(
            select(IngestionCheckpoint).where(IngestionCheckpoint.name == name)
        )
        return result.scalars().first()

    async def get_checkpoints(self, names: Sequence[str]) -> dict[str, IngestionCheckpoint]:
        if not names:
            return {}
        result = await self.session.execute(
            select(IngestionCheckpoint).where(IngestionCheckpoint.name.in_(names))
        )
        return {checkpoint.name: checkpoint for checkpoint in result.scalars()}

    async def save_checkpoint(self, name: str, succeeded_at: datetime) -> None:
        table = IngestionCheckpoint.__table__
        await self.session.execute(
            insert(table)
            .values(name=name, succeeded_at=succeeded_at)
            .on_conflict_do_update(index_elements=['name'], set_={'succeeded_at': succeeded_at})
        )
