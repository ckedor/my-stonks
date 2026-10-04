"""The overview reads one scalar, with the full analysis' period and units."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest

from app.lib.finance.analysis import calculate_performance_metrics
from app.modules.market_data.domain.constants import SERIES
from app.modules.portfolio.service.portfolio_position_service import PortfolioPositionService
from tests.fakes import FakeCache, FakeUnitOfWork


@pytest.mark.asyncio
@pytest.mark.parametrize('currency', ['BRL', 'USD'])
async def test_cdi_cagr_matches_analysis_without_calculating_risk(currency):
    dates = pd.date_range('2024-01-02', periods=6, freq='30D')
    daily_returns = pd.Series([0, 0.02, -0.01, 0.03, 0.01, 0.015], index=dates)
    rows = [{'date': day, 'daily_return': value} for day, value in daily_returns.items()]
    repository = SimpleNamespace(get_portfolio_returns=AsyncMock(return_value=rows))
    cdi = pd.Series([100, 101, 102, 103, 104, 105], index=dates, dtype=float)
    market_data = SimpleNamespace(get_series_history_values=AsyncMock(return_value=cdi))
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository), market_data, FakeCache()
    )
    expected = calculate_performance_metrics(daily_returns, {'CDI': cdi})['benchmarks_metrics'][
        'CDI'
    ]['cagr']

    with patch(
        'app.modules.portfolio.service.portfolio_position_service.calculate_returns_analysis',
        side_effect=AssertionError('The overview must not calculate the full analysis'),
    ):
        result = await service.get_portfolio_cdi_cagr(7, currency)

    assert result == pytest.approx(expected)
    repository.get_portfolio_returns.assert_awaited_once_with(7, currency)
    market_data.get_series_history_values.assert_awaited_once_with(dates[0], SERIES.CDI, currency)


@pytest.mark.asyncio
async def test_no_consolidated_history_has_no_cdi_cagr():
    repository = SimpleNamespace(get_portfolio_returns=AsyncMock(return_value=[]))
    market_data = SimpleNamespace(get_series_history_values=AsyncMock())
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository), market_data, FakeCache()
    )

    assert await service.get_portfolio_cdi_cagr(7) is None
    market_data.get_series_history_values.assert_not_awaited()
