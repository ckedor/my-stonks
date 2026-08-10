import math
from unittest.mock import AsyncMock, Mock

import pytest

from app.infra.db import bootstrap as _db_bootstrap  # noqa: F401 - maps ``Quote`` to its table
from app.infra.db.repositories.base_repository import UPSERT_CHUNK_SIZE, SQLAlchemyRepository
from app.modules.market_data.domain.quote import Quote

EXPECTED_ROWS = UPSERT_CHUNK_SIZE * 2 + 1
EXPECTED_STATEMENTS = 3
SMALL_WRITE_ROWS = 3


def build_repository():
    session = Mock(execute=AsyncMock())
    return SQLAlchemyRepository(session), session


def build_quote_rows(count: int) -> list[dict]:
    return [
        {
            'asset_id': 10,
            'date': f'2025-01-{index % 28 + 1:02d}',
            'close': float(index),
            'source': 'test-provider',
        }
        for index in range(count)
    ]


@pytest.mark.asyncio
async def test_upsert_splits_large_writes_into_bounded_statements():
    repository, session = build_repository()

    await repository.upsert_bulk(
        Quote,
        build_quote_rows(EXPECTED_ROWS),
        unique_columns=['asset_id', 'date'],
    )

    assert session.execute.await_count == EXPECTED_STATEMENTS
    batch_sizes = [len(call.args[1]) for call in session.execute.await_args_list]
    assert batch_sizes == [UPSERT_CHUNK_SIZE, UPSERT_CHUNK_SIZE, 1]
    assert sum(batch_sizes) == EXPECTED_ROWS


@pytest.mark.asyncio
async def test_upsert_sends_every_row_once_and_in_order():
    repository, session = build_repository()
    rows = build_quote_rows(EXPECTED_ROWS)

    await repository.upsert_bulk(Quote, rows, unique_columns=['asset_id', 'date'])

    sent = [row for call in session.execute.await_args_list for row in call.args[1]]
    assert [row['close'] for row in sent] == [row['close'] for row in rows]


@pytest.mark.asyncio
async def test_upsert_fits_a_small_write_in_a_single_statement():
    repository, session = build_repository()

    await repository.upsert_bulk(
        Quote,
        build_quote_rows(SMALL_WRITE_ROWS),
        unique_columns=['asset_id', 'date'],
    )

    session.execute.assert_awaited_once()
    assert len(session.execute.await_args.args[1]) == SMALL_WRITE_ROWS


@pytest.mark.asyncio
async def test_upsert_normalizes_missing_numbers_to_null_in_every_chunk():
    repository, session = build_repository()
    rows = build_quote_rows(EXPECTED_ROWS)
    for row in rows:
        row['close'] = math.nan

    await repository.upsert_bulk(Quote, rows, unique_columns=['asset_id', 'date'])

    sent = [row for call in session.execute.await_args_list for row in call.args[1]]
    assert len(sent) == EXPECTED_ROWS
    assert all(row['close'] is None for row in sent)
