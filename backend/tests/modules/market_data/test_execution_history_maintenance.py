from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from app.modules.market_data.repositories.ingestion_repository import (
    DataIngestionRepository,
)
from sqlalchemy.sql.dml import Delete, Update

EXPECTED_MAINTENANCE_STATEMENTS = 3


@pytest.mark.asyncio
async def test_execution_history_expires_stale_rows_and_deletes_old_rows():
    session = AsyncMock()
    repository = DataIngestionRepository(session)
    now = datetime(2026, 8, 2, 20, 0, tzinfo=timezone.utc)

    await repository.maintain_execution_history(
        now=now,
        retention=timedelta(days=2),
        queued_timeout=timedelta(minutes=5),
        running_timeout=timedelta(hours=6),
    )

    statements = [call.args[0] for call in session.execute.await_args_list]
    assert len(statements) == EXPECTED_MAINTENANCE_STATEMENTS
    assert isinstance(statements[0], Update)
    assert isinstance(statements[1], Update)
    assert isinstance(statements[2], Delete)
    assert all('market_data.data_ingestion_execution' in str(statement) for statement in statements)
