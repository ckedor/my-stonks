from unittest.mock import AsyncMock, Mock

import pytest

from app.infra.db.unit_of_work import UnitOfWork


@pytest.mark.asyncio
async def test_unit_of_work_commits_and_closes_on_success():
    session = Mock(commit=AsyncMock(), rollback=AsyncMock(), close=AsyncMock())
    session_factory = Mock(return_value=session)

    async with UnitOfWork(session_factory) as uow:
        assert uow.repository.session is session
        assert uow.assets.session is session
        assert uow.market_data.session is session
        assert uow.quotes.session is session
        assert uow.ingestions.session is session
        assert uow.portfolios.session is session

    session.commit.assert_awaited_once()
    session.rollback.assert_not_awaited()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_unit_of_work_rolls_back_and_closes_on_error():
    session = Mock(commit=AsyncMock(), rollback=AsyncMock(), close=AsyncMock())
    session_factory = Mock(return_value=session)

    with pytest.raises(RuntimeError, match='write failed'):
        async with UnitOfWork(session_factory):
            raise RuntimeError('write failed')

    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_unit_of_work_rolls_back_and_closes_when_commit_fails():
    session = Mock(
        commit=AsyncMock(side_effect=RuntimeError('commit failed')),
        rollback=AsyncMock(),
        close=AsyncMock(),
    )
    session_factory = Mock(return_value=session)

    with pytest.raises(RuntimeError, match='commit failed'):
        async with UnitOfWork(session_factory):
            pass

    session.rollback.assert_awaited_once()
    session.close.assert_awaited_once()
