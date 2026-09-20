from types import SimpleNamespace
from unittest.mock import AsyncMock

import numpy as np
import pandas as pd
import pytest

from app.modules.portfolio.domain.entities import Position
from app.modules.portfolio.domain.portfolio_consolidation import (
    consolidate_positions,
    consolidate_recent_positions,
)
from app.modules.portfolio.service.portfolio_consolidator_service import (
    PortfolioConsolidatorService,
)


def inputs(transactions):
    dates = pd.date_range('2023-01-01', '2025-03-20')
    prices = pd.DataFrame({
        'date': dates,
        'close': 20 + np.arange(len(dates)) * 0.01,
        'currency': 1,
    })
    fx = pd.DataFrame({'date': dates, 'usd_brl': 5 + np.arange(len(dates)) * 0.001})
    fx['brl_usd'] = 1 / fx['usd_brl']
    dividends = pd.DataFrame({
        'date': pd.to_datetime(['2024-03-01', '2025-03-01', '2025-03-12']),
        'amount': [2.0, 3.0, 4.0],
        'amount_usd': [0.4, 0.6, 0.8],
    })
    rows = [
        {'date': date, 'quantity': qty, 'price': price, 'price_usd': price / 5}
        for date, qty, price in transactions
    ]
    return rows, prices, fx, dividends


@pytest.mark.parametrize(
    'tail',
    [
        [],
        [('2025-03-05', 4, 25)],
        [('2025-03-05', -10, 25)],
        [('2025-03-05', -10, 25), ('2025-03-10', 6, 26)],
        [('2025-02-28', -10, 25), ('2025-03-10', 6, 26)],
    ],
)
def test_incremental_matches_full_history(tail):
    rows, prices, fx, dividends = inputs([('2023-01-01', 10, 20), *tail])
    start = pd.Timestamp('2025-03-01')
    full = consolidate_positions(rows, [], prices, fx, dividends)
    # Keep the checkpoint and original start date; the daily tail is rebuilt.
    history = full[
        (full.date == full.date.min())
        | ((full.date >= start - pd.DateOffset(years=1)) & (full.date < start))
    ].copy()
    assert history.date.max() == start - pd.Timedelta(days=1)
    actual = consolidate_recent_positions(
        rows, prices[prices.date >= start], fx, dividends, history, start
    )
    expected = full[full.date >= start].reset_index(drop=True)
    columns = [c for c in Position.COLUMNS if c not in {'portfolio_id', 'asset_id'}]
    pd.testing.assert_frame_equal(
        actual[columns], expected[columns], check_dtype=False, rtol=1e-10, atol=1e-10
    )


async def test_incremental_delete_is_restricted_even_when_new_tail_is_empty():
    repository = SimpleNamespace(delete=AsyncMock(), upsert_bulk=AsyncMock())
    start = pd.Timestamp('2025-03-01')
    await PortfolioConsolidatorService._persist_positions_db(
        pd.DataFrame(),
        pd.Timestamp('2023-01-01'),
        SimpleNamespace(id=7),
        3,
        repository=repository,
        replace_from=start,
    )
    repository.delete.assert_awaited_once_with(
        Position, by={'portfolio_id': 3, 'asset_id': 7, 'date__gte': start.date()}
    )
    repository.upsert_bulk.assert_not_awaited()


@pytest.mark.parametrize(
    ('incremental', 'events', 'asset_type', 'has_history'),
    [
        (True, [], 4, True),
        (False, [], 4, True),
        (True, [], 4, False),
        (True, [SimpleNamespace(date='2024-01-01', factor=2)], 4, True),
        (True, [], 3, True),
    ],
)
async def test_service_selects_tail_only_for_eligible_existing_positions(
    monkeypatch,
    incremental,
    events,
    asset_type,
    has_history,
):
    from tests.fakes import FakeUnitOfWork

    rows, prices, fx, dividends = inputs([('2023-01-01', 10, 20)])
    full = consolidate_positions(rows, [], prices, fx, dividends)
    history = (
        full[full.date <= pd.Timestamp('2025-03-10')].copy() if has_history else pd.DataFrame()
    )
    repository = SimpleNamespace(
        get_asset_details=AsyncMock(
            return_value=SimpleNamespace(
                id=7, ticker='TEST', asset_type=SimpleNamespace(id=asset_type)
            )
        ),
        get_transactions=AsyncMock(return_value=rows),
        get=AsyncMock(side_effect=[events, dividends]),
        get_position_consolidation_history=AsyncMock(return_value=history),
        delete=AsyncMock(),
        upsert_bulk=AsyncMock(),
    )
    service = PortfolioConsolidatorService(
        uow=FakeUnitOfWork(portfolios=repository, quotes=SimpleNamespace()),
        provider=SimpleNamespace(),
        usd_brl_service=SimpleNamespace(
            get_history_df=AsyncMock(return_value=fx),
            get_rate_on_or_before=AsyncMock(return_value=SimpleNamespace(usd_brl=5.0, brl_usd=0.2)),
        ),
    )
    fetch = AsyncMock(return_value=prices)
    monkeypatch.setattr(PortfolioConsolidatorService, '_get_asset_prices', fetch)
    await service.recalculate_position_asset(3, 7, incremental=incremental)
    eligible = incremental and not events and asset_type == 4 and has_history
    expected_start = pd.Timestamp('2025-02-23') if eligible else pd.Timestamp('2023-01-01')
    assert fetch.call_args.args[3] == expected_start
    filters = repository.delete.call_args.kwargs['by']
    assert filters == (
        {'portfolio_id': 3, 'asset_id': 7, 'date__gte': expected_start.date()}
        if eligible
        else {'portfolio_id': 3, 'asset_id': 7}
    )
    persisted = repository.upsert_bulk.call_args.args[1]
    assert min(row['date'] for row in persisted) == expected_start


async def test_dividend_writes_enqueue_complete_asset_recalculation(monkeypatch):
    from unittest.mock import Mock

    from app.modules.portfolio.api.dividend import router as routes
    from app.modules.portfolio.api.dividend.schema import (
        DividendCreateRequest,
        DividendUpdateRequest,
    )

    dispatch = Mock()
    monkeypatch.setattr(routes, 'run_task_by_name', dispatch)
    record = {'portfolio_id': 3, 'asset_id': 7}
    service = SimpleNamespace(
        create_dividend=AsyncMock(return_value=record),
        update_dividend=AsyncMock(return_value=record),
        delete_dividend=AsyncMock(return_value=record),
    )
    await routes.create_dividend(
        DividendCreateRequest(portfolio_id=3, asset_id=7, date='2020-01-01', amount=10), service
    )
    await routes.update_dividend(1, DividendUpdateRequest(id=1, amount=20), service)
    await routes.delete_dividend(1, service)
    assert dispatch.call_count == 3
    for call in dispatch.call_args_list:
        assert call.args == ('recalculate_asset_position', 3, 7)


def test_changed_recent_quote_and_dividend_match_full_rebuild():
    rows, prices, fx, dividends = inputs([('2023-01-01', 10, 20)])
    old = consolidate_positions(rows, [], prices, fx, dividends)
    start = pd.Timestamp('2025-03-01')
    prices.loc[prices.date == start, 'close'] += 2
    dividends.loc[dividends.date == start, ['amount', 'amount_usd']] *= 2
    expected = consolidate_positions(rows, [], prices, fx, dividends)
    actual = consolidate_recent_positions(
        rows, prices[prices.date >= start], fx, dividends, old[old.date < start], start
    )
    columns = [c for c in Position.COLUMNS if c not in {'portfolio_id', 'asset_id'}]
    pd.testing.assert_frame_equal(
        actual[columns],
        expected[expected.date >= start][columns].reset_index(drop=True),
        check_dtype=False,
        rtol=1e-10,
        atol=1e-10,
    )


def test_weekend_boundary_and_repeated_incremental_run():
    rows, prices, fx, dividends = inputs([('2023-01-02', 10, 20)])
    prices = prices[prices.date.dt.dayofweek < 5]
    fx = fx[fx.date.dt.dayofweek < 5]
    full = consolidate_positions(rows, [], prices, fx, dividends)
    start = pd.Timestamp('2025-03-01')
    actual = consolidate_recent_positions(
        rows,
        prices[prices.date >= start],
        fx,
        dividends,
        full[full.date < start],
        start,
    )
    columns = [c for c in Position.COLUMNS if c not in {'portfolio_id', 'asset_id'}]
    expected = full[full.date >= start][columns].reset_index(drop=True)
    pd.testing.assert_frame_equal(
        actual[columns], expected, check_dtype=False, rtol=1e-10, atol=1e-10
    )
    rebuilt = pd.concat([full[full.date < start], actual], ignore_index=True)
    second_start = start + pd.Timedelta(days=3)
    second = consolidate_recent_positions(
        rows,
        prices[prices.date >= second_start],
        fx,
        dividends,
        rebuilt,
        second_start,
    )
    pd.testing.assert_frame_equal(
        second[columns],
        full[full.date >= second_start][columns].reset_index(drop=True),
        check_dtype=False,
        rtol=1e-10,
        atol=1e-10,
    )


async def test_moving_transaction_rebuilds_old_and_new_assets(monkeypatch):
    from unittest.mock import Mock

    from app.modules.portfolio.api.transaction import router as routes

    dispatch = Mock()
    monkeypatch.setattr(routes, 'run_task_by_name', dispatch)
    service = SimpleNamespace(update_transaction=AsyncMock(return_value=(3, 7)))
    await routes.update_transaction(1, {'portfolio_id': 3, 'asset_id': 8}, service)
    assert [call.args for call in dispatch.call_args_list] == [
        ('recalculate_asset_position', 3, 8),
        ('recalculate_asset_position', 3, 7),
    ]
