import json
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.portfolio.domain.entities import AssetTypeReturn
from app.modules.portfolio.domain.returns import calculate_portfolio_daily_returns
from app.modules.portfolio.service.portfolio_position_service import PortfolioPositionService
from app.modules.portfolio.service.portfolio_returns_consolidator_service import (
    PortfolioReturnsConsolidatorService,
)
from tests.fakes import FakeCache, FakeUnitOfWork


class JsonValidatingCache(FakeCache):
    async def set_json(self, key: str, value, expire_seconds: int | None = None) -> None:
        json.dumps(value, allow_nan=False)
        await super().set_json(key, value, expire_seconds)


def _position_history() -> pd.DataFrame:
    rows = []
    for day, fii_price, stock_price in (
        ('2025-01-02', 100.0, 20.0),
        ('2025-07-02', 110.0, 22.0),
        ('2026-01-02', 121.0, 19.8),
    ):
        rows.extend([
            {
                'date': day,
                'asset_id': 10,
                'asset_type_id': 2,
                'ticker': 'FIIX11',
                'quantity': 10.0,
                'price': fii_price,
                'price_usd': fii_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
            {
                'date': day,
                'asset_id': 20,
                'asset_type_id': 4,
                'ticker': 'ACAO3',
                'quantity': 10.0,
                'price': stock_price,
                'price_usd': stock_price / 5,
                'dividend': 0.0,
                'dividend_usd': 0.0,
            },
        ])
    return pd.DataFrame(rows)


@pytest.mark.asyncio
async def test_consolidates_one_independent_return_series_per_asset_type():
    repository = SimpleNamespace(upsert_bulk=AsyncMock())
    positions = calculate_portfolio_daily_returns(_position_history())
    service = PortfolioReturnsConsolidatorService(SimpleNamespace())

    await service._consolidate_asset_type_returns(repository, positions, portfolio_id=7)

    entity, records = repository.upsert_bulk.await_args.args
    assert entity is AssetTypeReturn
    assert repository.upsert_bulk.await_args.kwargs['unique_columns'] == [
        'portfolio_id',
        'asset_type_id',
        'date',
    ]
    assert len(records) == 6

    fii_records = [record for record in records if record['asset_type_id'] == 2]
    assert fii_records[-1]['acc_return'] == pytest.approx(0.21)
    assert fii_records[-1]['cagr'] == pytest.approx(0.21, rel=0.01)

    stock_records = [record for record in records if record['asset_type_id'] == 4]
    assert stock_records[-1]['acc_return'] == pytest.approx(-0.01)


@pytest.mark.asyncio
async def test_asset_type_read_falls_back_to_position_history_before_first_consolidation():
    rows = _position_history()
    rows = rows.loc[rows['asset_type_id'] == 2].to_dict(orient='records')
    repository = SimpleNamespace(
        get_asset_type_returns=AsyncMock(return_value=[]),
        get_portfolio_position=AsyncMock(return_value=rows),
    )
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=FakeCache(),
    )

    result = await service.get_asset_type_returns(7, 2)

    repository.get_asset_type_returns.assert_awaited_once_with(7, 2, 'BRL')
    repository.get_portfolio_position.assert_awaited_once_with(7, asset_type_id=2)
    assert result[-1]['date'] == '2026-01-02'
    assert result[-1]['acc_return'] == pytest.approx(0.21)
    assert result[-1]['cagr'] == pytest.approx(0.21, rel=0.01)


@pytest.mark.asyncio
async def test_persisted_asset_type_returns_are_json_safe_before_caching():
    repository = SimpleNamespace(
        get_asset_type_returns=AsyncMock(
            return_value=[
                {
                    'date': date(2026, 1, 2),
                    'asset_type_id': 2,
                    'asset_type': 'FII',
                    'daily_return': 0.01,
                    'acc_return': 0.21,
                    'cagr': 0.21,
                }
            ]
        ),
        get_portfolio_position=AsyncMock(),
    )
    service = PortfolioPositionService(
        FakeUnitOfWork(portfolios=repository),
        market_data_service=SimpleNamespace(),
        cache=JsonValidatingCache(),
    )

    result = await service.get_asset_type_returns(7, 2)

    assert result[0]['date'] == '2026-01-02'
    repository.get_portfolio_position.assert_not_awaited()
