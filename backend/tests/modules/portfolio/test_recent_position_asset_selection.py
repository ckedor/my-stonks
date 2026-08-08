from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import app.infra.db.bootstrap  # noqa: F401
from app.modules.portfolio.domain.portfolio_consolidation import (
    DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION,
)
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)

EXPECTED_RECENT_WINDOW_DAYS = 5


@pytest.mark.asyncio
async def test_recent_position_selection_uses_global_latest_five_days_and_non_zero_quantity():
    scalars = SimpleNamespace(return_value=[10, 20])
    result = SimpleNamespace(scalars=lambda: scalars.return_value)
    session = SimpleNamespace(execute=AsyncMock(return_value=result))
    repository = PortfolioRepository(session)

    asset_ids = await repository.get_recent_position_asset_ids(
        window_days=5,
        asset_type_ids=[1, 2, 4],
    )

    statement = session.execute.await_args.args[0]
    sql = str(statement)
    assert asset_ids == [10, 20]
    assert 'max(portfolio.position.date)' in sql
    assert 'GROUP BY' not in sql
    assert 'portfolio.position.quantity !=' in sql
    assert 'asset.asset_type_id IN' in sql


@pytest.mark.asyncio
async def test_portfolio_consolidation_uses_only_recent_non_zero_positions():
    repository = SimpleNamespace(
        get_most_recent_asset_ids_from_position=AsyncMock(return_value=[]),
        get_asset_ids_with_transactions=AsyncMock(return_value=[99]),
    )
    service = PortfolioConsolidatorService(
        repository=repository,
        market_data_service=SimpleNamespace(),
    )

    result = await service.get_asset_ids_to_consolidate(portfolio_id=3)

    assert result == []
    repository.get_most_recent_asset_ids_from_position.assert_awaited_once_with(
        portfolio_id=3,
        delta_days=DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION,
    )
    repository.get_asset_ids_with_transactions.assert_not_awaited()
    assert DELTA_DAYS_FOR_PORTFOLIO_CONSOLIDATION == EXPECTED_RECENT_WINDOW_DAYS
