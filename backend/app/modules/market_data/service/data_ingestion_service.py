from collections.abc import Callable
from datetime import datetime, timezone

from app.core.exceptions import AlreadyExistsError, NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.ingestion import (
    ABORTED_STATUS,
    ACTIVE_EXECUTION_STATUSES,
    DataIngestionAttempt,
    DataIngestionType,
)

#: Recorded on an aborted execution and on every attempt it left open.
ABORT_REASON = 'Execução abortada manualmente'


class DataIngestionReadService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list_executions(self, *, ingestion_type: DataIngestionType, limit: int):
        async with self.uow as uow:
            return await uow.ingestions.list_executions(
                ingestion_type=ingestion_type,
                limit=limit,
            )

    async def get_execution(
        self,
        execution_id: int,
        *,
        ingestion_type: DataIngestionType,
        include_attempts: bool = False,
    ):
        async with self.uow as uow:
            execution = await uow.ingestions.get_execution(
                execution_id,
                include_attempts=include_attempts,
            )
            if execution is None or execution.ingestion_type != ingestion_type.value:
                raise NotFoundError('Data ingestion execution not found')
            return execution

    async def list_quote_executions(self, *, limit: int):
        return await self.list_executions(
            ingestion_type=DataIngestionType.QUOTE,
            limit=limit,
        )

    async def get_quote_execution(self, execution_id: int):
        return await self.get_execution(
            execution_id,
            ingestion_type=DataIngestionType.QUOTE,
            include_attempts=True,
        )

    async def list_series_executions(self, *, limit: int):
        return await self.list_executions(
            ingestion_type=DataIngestionType.MARKET_DATA_SERIES,
            limit=limit,
        )

    async def get_series_execution(self, execution_id: int):
        return await self.get_execution(
            execution_id,
            ingestion_type=DataIngestionType.MARKET_DATA_SERIES,
            include_attempts=True,
        )

    async def list_usd_brl_executions(self, *, limit: int):
        return await self.list_executions(
            ingestion_type=DataIngestionType.USD_BRL,
            limit=limit,
        )

    async def get_usd_brl_execution(self, execution_id: int):
        return await self.get_execution(
            execution_id,
            ingestion_type=DataIngestionType.USD_BRL,
            include_attempts=True,
        )


class DataIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
    ):
        self.uow_factory = uow_factory

    async def maintain_history(self) -> None:
        async with self.uow_factory() as uow:
            await uow.ingestions.maintain_execution_history()
            await uow.commit()

    async def request_manual_execution(
        self,
        *,
        ingestion_type: DataIngestionType,
        requested_by_user_id: int,
        item_ids: list[int] | None,
        force_full_history: bool,
    ):
        async with self.uow_factory() as uow:
            await uow.ingestions.maintain_execution_history()
            active = await uow.ingestions.get_active_execution(ingestion_type)
            if active is not None:
                raise AlreadyExistsError(
                    'A data ingestion of this type is already running',
                    context={'execution_id': active.id},
                )
            execution = await uow.ingestions.create_execution(
                ingestion_type=ingestion_type,
                trigger='manual',
                force_full_history=force_full_history,
                item_ids=item_ids,
                requested_by_user_id=requested_by_user_id,
            )
            await uow.commit()
            return execution

    async def abort_execution(
        self,
        *,
        ingestion_type: DataIngestionType,
        execution_id: int,
    ):
        """Stop an execution that is queued or already running.

        Aborting is cooperative. It closes the execution and the attempts it
        left open, which frees the one-execution-per-type slot immediately, and
        the runners check ``is_aborted`` between items so the worker stops on
        its own. Work already in flight for the current item still finishes:
        nothing here interrupts it.
        """
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
            if execution is None or execution.ingestion_type != ingestion_type.value:
                raise NotFoundError('Data ingestion execution not found')
            if execution.status not in ACTIVE_EXECUTION_STATUSES:
                raise ValidationError(
                    'Only a queued or running data ingestion can be aborted',
                    context={'execution_id': execution_id, 'status': execution.status},
                )
            aborted_at = datetime.now(timezone.utc)
            await uow.ingestions.abort_unfinished_attempts(
                execution_id,
                now=aborted_at,
                error=ABORT_REASON,
            )
            execution.status = ABORTED_STATUS
            execution.finished_at = aborted_at
            execution.error = ABORT_REASON
            await uow.commit()
            return execution

    async def is_aborted(self, execution_id: int | None) -> bool:
        """Whether the runner should stop working on ``execution_id``.

        An execution that no longer exists counts as aborted: history
        maintenance deleted it, so there is nothing left to report progress to.
        """
        if execution_id is None:
            return False
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
        return execution is None or execution.status == ABORTED_STATUS

    async def abort_quote_execution(self, execution_id: int):
        return await self.abort_execution(
            ingestion_type=DataIngestionType.QUOTE,
            execution_id=execution_id,
        )

    async def abort_series_execution(self, execution_id: int):
        return await self.abort_execution(
            ingestion_type=DataIngestionType.MARKET_DATA_SERIES,
            execution_id=execution_id,
        )

    async def abort_usd_brl_execution(self, execution_id: int):
        return await self.abort_execution(
            ingestion_type=DataIngestionType.USD_BRL,
            execution_id=execution_id,
        )

    async def set_task_id(self, execution_id: int, task_id: str):
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
            execution.task_id = task_id
            await uow.commit()
            return execution

    async def request_quote_execution(
        self,
        *,
        requested_by_user_id: int,
        item_ids: list[int] | None,
        force_full_history: bool,
    ):
        return await self.request_manual_execution(
            ingestion_type=DataIngestionType.QUOTE,
            requested_by_user_id=requested_by_user_id,
            item_ids=item_ids,
            force_full_history=force_full_history,
        )

    async def request_series_execution(
        self,
        *,
        requested_by_user_id: int,
        force_full_history: bool,
    ):
        return await self.request_manual_execution(
            ingestion_type=DataIngestionType.MARKET_DATA_SERIES,
            requested_by_user_id=requested_by_user_id,
            item_ids=None,
            force_full_history=force_full_history,
        )

    async def request_usd_brl_execution(
        self,
        *,
        requested_by_user_id: int,
        force_full_history: bool,
    ):
        return await self.request_manual_execution(
            ingestion_type=DataIngestionType.USD_BRL,
            requested_by_user_id=requested_by_user_id,
            item_ids=[1],
            force_full_history=force_full_history,
        )

    async def prepare_execution(
        self,
        *,
        ingestion_type: DataIngestionType,
        execution_id: int | None,
        force_full_history: bool,
        scheduled_item_ids: list[int] | None = None,
    ):
        async with self.uow_factory() as uow:
            await uow.ingestions.maintain_execution_history()
            if execution_id is None:
                active = await uow.ingestions.get_active_execution(ingestion_type)
                if active is not None:
                    # keep the history maintenance above even though we bail out
                    await uow.commit()
                    return None
                execution = await uow.ingestions.create_execution(
                    ingestion_type=ingestion_type,
                    trigger='scheduled',
                    force_full_history=force_full_history,
                    item_ids=scheduled_item_ids,
                )
            else:
                execution = await uow.ingestions.get_execution(execution_id)
                if execution is None or execution.ingestion_type != ingestion_type.value:
                    raise NotFoundError('Data ingestion execution not found')
            if execution.status != 'queued':
                await uow.commit()
                return None
            execution.status = 'running'
            execution.started_at = datetime.now(timezone.utc)
            execution.error = None
            await uow.commit()
            return (
                execution.id,
                bool(execution.force_full_history),
                list(execution.parameters.get('item_ids') or []),
            )

    async def set_execution_items(
        self,
        execution_id: int,
        *,
        item_ids: list[int],
        parameters: dict,
    ) -> None:
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
            execution.total_items = len(item_ids)
            execution.parameters = parameters
            await uow.commit()

    async def start_attempt(
        self,
        execution_id: int,
        *,
        item_id: int | None,
        item_label: str,
        source: str,
        parameters: dict,
    ) -> int:
        async with self.uow_factory() as uow:
            attempt = await uow.ingestions.create_attempt(
                execution_id=execution_id,
                item_id=item_id,
                item_label=item_label,
                source=source,
                parameters=parameters,
            )
            await uow.commit()
            return attempt.id

    async def finish_attempt(  # noqa: PLR0913
        self,
        execution_id: int,
        attempt_id: int,
        *,
        status: str,
        parameters: dict,
        fetched_rows: int = 0,
        upserted_rows: int = 0,
        error: str | None = None,
    ) -> None:
        async with self.uow_factory() as uow:
            attempt = await uow.ingestions.get(DataIngestionAttempt, id=attempt_id)
            attempt.status = status
            attempt.parameters = parameters
            attempt.finished_at = datetime.now(timezone.utc)
            attempt.fetched_rows = fetched_rows
            attempt.upserted_rows = upserted_rows
            attempt.error = error
            execution = await uow.ingestions.get_execution(execution_id)
            execution.processed_items += 1
            execution.fetched_rows += fetched_rows
            execution.upserted_rows += upserted_rows
            if status == 'success':
                execution.succeeded_items += 1
            else:
                execution.failed_items += 1
            await uow.commit()

    async def finish(self, execution_id: int) -> None:
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
            if execution is None or execution.status == ABORTED_STATUS:
                # The runner reached the end of what it had already started
                # after the abort landed. The abort is the final word.
                return
            execution.finished_at = datetime.now(timezone.utc)
            if execution.failed_items == 0:
                execution.status = 'success'
            elif execution.succeeded_items == 0:
                execution.status = 'failure'
            else:
                execution.status = 'partial_success'
            await uow.commit()

    async def fail(self, execution_id: int, error: Exception) -> None:
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
            if execution is not None and execution.status != ABORTED_STATUS:
                execution.status = 'failure'
                execution.error = str(error) or error.__class__.__name__
                execution.finished_at = datetime.now(timezone.utc)
            await uow.commit()
