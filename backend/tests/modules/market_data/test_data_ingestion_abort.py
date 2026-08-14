from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.sql.dml import Update

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.domain.ingestion import (
    ABORTED_STATUS,
    DataIngestionExecution,
    DataIngestionType,
)
from app.modules.market_data.repositories.ingestion_repository import (
    DataIngestionRepository,
)
from app.modules.market_data.service.data_ingestion_service import (
    ABORT_REASON,
    DataIngestionService,
)
from tests.fakes import FakeUnitOfWork, fake_uow_factory


def build_execution(status: str, ingestion_type: DataIngestionType = DataIngestionType.QUOTE):
    return DataIngestionExecution(
        id=8,
        ingestion_type=ingestion_type.value,
        trigger='manual',
        status=status,
        succeeded_items=10,
        failed_items=0,
    )


def build_service(execution: DataIngestionExecution | None):
    ingestions = SimpleNamespace(
        get_execution=AsyncMock(return_value=execution),
        abort_unfinished_attempts=AsyncMock(),
    )
    uow = FakeUnitOfWork(ingestions=ingestions)
    service = DataIngestionService(uow_factory=fake_uow_factory(uow))
    return service, uow, ingestions


@pytest.mark.asyncio
async def test_abort_closes_a_running_execution_and_its_open_attempts():
    execution = build_execution('running')
    service, uow, ingestions = build_service(execution)

    aborted = await service.abort_quote_execution(8)

    assert aborted.status == ABORTED_STATUS
    assert aborted.error == ABORT_REASON
    assert aborted.finished_at is not None
    ingestions.abort_unfinished_attempts.assert_awaited_once()
    assert ingestions.abort_unfinished_attempts.await_args.kwargs['error'] == ABORT_REASON
    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_abort_closes_an_execution_still_queued():
    execution = build_execution('queued')
    service, uow, _ = build_service(execution)

    aborted = await service.abort_quote_execution(8)

    assert aborted.status == ABORTED_STATUS
    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_abort_refuses_an_execution_that_already_finished():
    execution = build_execution('success')
    service, uow, ingestions = build_service(execution)

    with pytest.raises(ValidationError):
        await service.abort_quote_execution(8)

    ingestions.abort_unfinished_attempts.assert_not_awaited()
    uow.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_abort_refuses_an_execution_of_another_ingestion_type():
    execution = build_execution('running', DataIngestionType.USD_BRL)
    service, _, ingestions = build_service(execution)

    with pytest.raises(NotFoundError):
        await service.abort_quote_execution(8)

    ingestions.abort_unfinished_attempts.assert_not_awaited()


@pytest.mark.asyncio
async def test_abort_refuses_an_execution_that_does_not_exist():
    service, _, _ = build_service(None)

    with pytest.raises(NotFoundError):
        await service.abort_quote_execution(8)


@pytest.mark.asyncio
async def test_finish_does_not_resurrect_an_aborted_execution():
    execution = build_execution(ABORTED_STATUS)
    service, uow, _ = build_service(execution)

    await service.finish(8)

    assert execution.status == ABORTED_STATUS
    assert execution.finished_at is None
    uow.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_fail_does_not_overwrite_an_aborted_execution():
    execution = build_execution(ABORTED_STATUS)
    service, _, _ = build_service(execution)

    await service.fail(8, RuntimeError('provider timed out'))

    assert execution.status == ABORTED_STATUS
    assert execution.error is None


@pytest.mark.asyncio
async def test_finish_still_closes_an_execution_that_ran_to_the_end():
    execution = build_execution('running')
    service, uow, _ = build_service(execution)

    await service.finish(8)

    assert execution.status == 'success'
    uow.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('execution', 'expected'),
    [
        (build_execution(ABORTED_STATUS), True),
        (build_execution('running'), False),
        (None, True),
    ],
)
async def test_is_aborted_tells_a_runner_whether_to_stop(execution, expected):
    service, _, _ = build_service(execution)

    assert await service.is_aborted(8) is expected


@pytest.mark.asyncio
async def test_is_aborted_is_false_when_no_execution_is_being_tracked():
    service, uow, _ = build_service(None)

    assert await service.is_aborted(None) is False
    assert uow.entered == 0


@pytest.mark.asyncio
async def test_aborting_attempts_closes_only_the_ones_left_running():
    session = AsyncMock()
    repository = DataIngestionRepository(session)

    await repository.abort_unfinished_attempts(
        8,
        now=datetime(2026, 8, 10, 5, 42, tzinfo=UTC),
        error=ABORT_REASON,
    )

    statement = session.execute.await_args.args[0]
    assert isinstance(statement, Update)
    rendered = str(statement)
    assert 'market_data.data_ingestion_attempt' in rendered
    assert 'status' in rendered
