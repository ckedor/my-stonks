from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, desc, func, select, update
from sqlalchemy.orm import selectinload

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.market_data.domain.ingestion import (
    ABORTED_STATUS,
    ACTIVE_EXECUTION_STATUSES,
    DataIngestionAttempt,
    DataIngestionExecution,
    DataIngestionType,
)


class DataIngestionRepository(SQLAlchemyRepository):
    async def create_execution(
        self,
        *,
        ingestion_type: DataIngestionType,
        trigger: str,
        force_full_history: bool,
        item_ids: list[int] | None = None,
        requested_by_user_id: int | None = None,
    ) -> DataIngestionExecution:
        execution = DataIngestionExecution(
            ingestion_type=ingestion_type.value,
            trigger=trigger,
            status='queued',
            force_full_history=force_full_history,
            parameters={
                'force_full_history': force_full_history,
                'item_ids': item_ids or [],
            },
            requested_by_user_id=requested_by_user_id,
        )
        self.session.add(execution)
        await self.session.flush()
        return execution

    async def get_execution(
        self,
        execution_id: int,
        *,
        include_attempts: bool = False,
    ) -> DataIngestionExecution | None:
        stmt = select(DataIngestionExecution).where(DataIngestionExecution.id == execution_id)
        if include_attempts:
            stmt = stmt.options(selectinload(DataIngestionExecution.attempts))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_executions(
        self,
        *,
        ingestion_type: DataIngestionType,
        limit: int = 50,
    ) -> list[DataIngestionExecution]:
        result = await self.session.execute(
            select(DataIngestionExecution)
            .where(DataIngestionExecution.ingestion_type == ingestion_type.value)
            .order_by(desc(DataIngestionExecution.requested_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_active_execution(
        self,
        ingestion_type: DataIngestionType,
    ) -> DataIngestionExecution | None:
        result = await self.session.execute(
            select(DataIngestionExecution)
            .where(
                DataIngestionExecution.ingestion_type == ingestion_type.value,
                DataIngestionExecution.status.in_(ACTIVE_EXECUTION_STATUSES),
            )
            .order_by(desc(DataIngestionExecution.requested_at))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create_attempt(
        self,
        *,
        execution_id: int,
        item_id: int | None,
        item_label: str,
        source: str,
        parameters: dict,
    ) -> DataIngestionAttempt:
        attempt = DataIngestionAttempt(
            execution_id=execution_id,
            item_id=item_id,
            item_label=item_label,
            source=source,
            status='running',
            parameters=parameters,
        )
        self.session.add(attempt)
        await self.session.flush()
        return attempt

    async def abort_unfinished_attempts(
        self,
        execution_id: int,
        *,
        now: datetime,
        error: str,
    ) -> None:
        """Close the attempts an aborted execution left open.

        Attempts are created up front, before their item is fetched, so an
        abort leaves every item not yet reached sitting at ``running``. Without
        this they would stay open forever: the task that would have closed them
        is the one being stopped.
        """
        await self.session.execute(
            update(DataIngestionAttempt)
            .where(
                DataIngestionAttempt.execution_id == execution_id,
                DataIngestionAttempt.status == 'running',
            )
            .values(status=ABORTED_STATUS, finished_at=now, error=error)
            .execution_options(synchronize_session=False)
        )

    async def maintain_execution_history(
        self,
        *,
        now: datetime | None = None,
        retention: timedelta = timedelta(days=2),
        queued_timeout: timedelta = timedelta(minutes=2),
        running_timeout: timedelta = timedelta(hours=6),
    ) -> None:
        current_time = now or datetime.now(UTC)
        await self.session.execute(
            update(DataIngestionExecution)
            .where(
                DataIngestionExecution.status == 'queued',
                DataIngestionExecution.requested_at < current_time - queued_timeout,
            )
            .values(
                status='failure',
                finished_at=current_time,
                error='A execução expirou antes de ser iniciada por um worker',
            )
            .execution_options(synchronize_session=False)
        )
        await self.session.execute(
            update(DataIngestionExecution)
            .where(
                DataIngestionExecution.status == 'running',
                func.coalesce(
                    DataIngestionExecution.started_at,
                    DataIngestionExecution.requested_at,
                )
                < current_time - running_timeout,
            )
            .values(
                status='failure',
                finished_at=current_time,
                error='A execução expirou sem receber um sinal de conclusão',
            )
            .execution_options(synchronize_session=False)
        )
        await self.session.execute(
            delete(DataIngestionExecution)
            .where(DataIngestionExecution.requested_at < current_time - retention)
            .execution_options(synchronize_session=False)
        )
