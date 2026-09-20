"""Which funds a share-value run takes, and what it dispatches afterwards."""

from datetime import date, timedelta
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import text

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.portfolio.service.portfolio_quote_ingestion_service import (
    PortfolioQuoteIngestionService,
)

FUND_TYPES = [ASSET_TYPE.FI, ASSET_TYPE.PREV]


async def fund(db, factory, *, ticker=None, legal_id='55139905000139', asset_type=ASSET_TYPE.FI):
    asset_id = await factory.asset(ticker=ticker, name='Fundo', asset_type_id=asset_type)
    await db.execute(
        text('INSERT INTO asset.fund (asset_id, legal_id) VALUES (:id, :legal_id)'),
        {'id': asset_id, 'legal_id': legal_id},
    )
    return asset_id


async def positions(db, portfolio_id, asset_id, first: date, last: date):
    day = first
    while day <= last:
        await db.execute(
            text(
                'INSERT INTO portfolio.position '
                '(portfolio_id, asset_id, date, quantity, average_price, price) '
                'VALUES (:portfolio_id, :asset_id, :day, 10, 1, 1)'
            ),
            {'portfolio_id': portfolio_id, 'asset_id': asset_id, 'day': day},
        )
        day += timedelta(days=1)


def selection_service():
    return PortfolioQuoteIngestionService(UnitOfWork())


async def test_a_routine_run_takes_first_and_retrodated_purchases_but_not_settled_ones(db, factory):
    portfolio = await factory.portfolio()
    other_portfolio = await factory.portfolio(name='Outra')
    broker = await factory.broker()
    first_purchase = await fund(db, factory)
    retrodated = await fund(db, factory)
    settled_long_ago = await fund(db, factory)
    listed = await fund(db, factory, ticker='JURO11')
    no_cnpj = await fund(db, factory, legal_id=None)
    pension = await fund(db, factory, asset_type=ASSET_TYPE.PREV)

    await factory.transaction(
        portfolio_id=portfolio, asset_id=first_purchase, broker_id=broker, on=date(2026, 9, 10)
    )
    # Held from June in one portfolio; bought again in another in May.
    await factory.transaction(
        portfolio_id=portfolio, asset_id=retrodated, broker_id=broker, on=date(2026, 6, 1)
    )
    await positions(db, portfolio, retrodated, date(2026, 6, 1), date(2026, 6, 3))
    await factory.transaction(
        portfolio_id=other_portfolio, asset_id=retrodated, broker_id=broker, on=date(2026, 5, 4)
    )
    # Bought and sold before the latest position window, fully consolidated.
    await factory.transaction(
        portfolio_id=portfolio, asset_id=settled_long_ago, broker_id=broker, on=date(2026, 1, 5)
    )
    await factory.transaction(
        portfolio_id=portfolio,
        asset_id=settled_long_ago,
        broker_id=broker,
        quantity=-100,
        on=date(2026, 1, 8),
    )
    await positions(db, portfolio, settled_long_ago, date(2026, 1, 5), date(2026, 1, 7))
    for asset_id in (listed, no_cnpj):
        await factory.transaction(
            portfolio_id=portfolio, asset_id=asset_id, broker_id=broker, on=date(2026, 9, 1)
        )
    await factory.transaction(
        portfolio_id=portfolio, asset_id=pension, broker_id=broker, on=date(2026, 2, 2)
    )
    await positions(db, portfolio, pension, date(2026, 9, 14), date(2026, 9, 16))
    await positions(db, portfolio, retrodated, date(2026, 9, 14), date(2026, 9, 16))

    routine = await selection_service().get_funds_requiring_share_values(
        full_history=False, asset_type_ids=FUND_TYPES
    )
    full = await selection_service().get_funds_requiring_share_values(
        full_history=True, asset_type_ids=FUND_TYPES
    )

    assert routine.since == {
        first_purchase: date(2026, 9, 10),
        retrodated: date(2026, 5, 4),
        # Not a first purchase and nothing uncovered, but held recently.
        pension: date(2026, 2, 2),
    }
    assert full.since == {
        first_purchase: date(2026, 9, 10),
        retrodated: date(2026, 5, 4),
        settled_long_ago: date(2026, 1, 5),
        pension: date(2026, 2, 2),
    }


async def test_funds_chosen_by_id_use_their_purchases_and_one_never_bought_is_reported(db, factory):
    portfolio = await factory.portfolio()
    broker = await factory.broker()
    bought = await fund(db, factory)
    never_bought = await fund(db, factory)
    await factory.transaction(
        portfolio_id=portfolio, asset_id=bought, broker_id=broker, on=date(2026, 9, 10)
    )

    selection = await selection_service().get_funds_requiring_share_values(
        full_history=False, asset_type_ids=FUND_TYPES, item_ids=[bought, never_bought]
    )

    assert selection.since == {bought: date(2026, 9, 10)}
    assert selection.without_purchase == [never_bought]


async def test_the_manual_route_hands_chosen_funds_to_the_portfolio_selection(client, no_celery):
    no_celery['send_task'].return_value = SimpleNamespace(id='task-1')

    response = await client.post(
        '/market_data/ingestions/fund_share_value',
        json={'item_ids': [7], 'force_full_history': True},
    )

    assert response.status_code == HTTPStatus.OK
    no_celery['send_task'].assert_called_once()
    name = no_celery['send_task'].call_args.args[0]
    arguments = no_celery['send_task'].call_args.kwargs['args']
    assert name == 'ingest_fund_share_values_for_held_funds'
    assert arguments == (response.json()['id'], True, [7])


async def test_changed_share_values_rebuild_every_position_of_the_asset(db, factory):
    from app.modules.portfolio.tasks import recalculate_positions_for_assets as task

    portfolio = await factory.portfolio()
    other_portfolio = await factory.portfolio(name='Outra')
    broker = await factory.broker()
    changed = await fund(db, factory)
    untouched = await fund(db, factory)
    for portfolio_id in (portfolio, other_portfolio):
        await factory.transaction(portfolio_id=portfolio_id, asset_id=changed, broker_id=broker)
    await factory.transaction(portfolio_id=portfolio, asset_id=untouched, broker_id=broker)

    with patch.object(task, 'run_task') as run_task:
        await task.recalculate_positions_for_assets.run.__wrapped__([changed])

    assert sorted(call.args[1:] for call in run_task.call_args_list) == [
        (portfolio, changed),
        (other_portfolio, changed),
    ]

    assert all(call.kwargs == {'ingest_share_values': False} for call in run_task.call_args_list)
