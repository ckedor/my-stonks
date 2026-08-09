from unittest.mock import AsyncMock, Mock

import pytest

from app.infra.db.unit_of_work import UnitOfWork


def build_session():
    return Mock(commit=AsyncMock(), rollback=AsyncMock(), close=AsyncMock())


@pytest.mark.asyncio
async def test_unit_of_work_exposes_repositories_on_one_session():
    session = build_session()

    async with UnitOfWork(Mock(return_value=session)) as uow:
        assert uow.repository.session is session
        assert uow.assets.session is session
        assert uow.market_data.session is session
        assert uow.quotes.session is session
        assert uow.ingestions.session is session
        assert uow.portfolios.session is session


@pytest.mark.asyncio
async def test_read_scope_does_not_commit():
    session = build_session()

    async with UnitOfWork(Mock(return_value=session)):
        pass

    session.commit.assert_not_awaited()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_write_scope_commits_when_asked():
    session = build_session()

    async with UnitOfWork(Mock(return_value=session)) as uow:
        await uow.commit()

    session.commit.assert_awaited_once()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_clean_exit_closes_without_expiring_loaded_instances():
    """``rollback()`` expires every instance in the identity map, which would
    detach the ORM objects services hand back to their callers. On the clean
    path ``close()`` alone discards uncommitted work at the connection level."""
    session = build_session()

    async with UnitOfWork(Mock(return_value=session)):
        pass

    session.rollback.assert_not_awaited()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_error_rolls_back_and_closes():
    session = build_session()

    with pytest.raises(RuntimeError, match='write failed'):
        async with UnitOfWork(Mock(return_value=session)):
            raise RuntimeError('write failed')

    session.commit.assert_not_awaited()
    session.rollback.assert_awaited_once()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_unit_of_work_cannot_be_entered_twice():
    uow = UnitOfWork(Mock(return_value=build_session()))

    async with uow:
        with pytest.raises(RuntimeError, match='already active'):
            async with uow:
                pass


@pytest.mark.asyncio
async def test_unit_of_work_can_be_reused_sequentially():
    sessions = [build_session(), build_session()]
    uow = UnitOfWork(Mock(side_effect=sessions))

    async with uow as first:
        await first.commit()
    async with uow as second:
        await second.commit()

    assert [session.commit.await_count for session in sessions] == [1, 1]
