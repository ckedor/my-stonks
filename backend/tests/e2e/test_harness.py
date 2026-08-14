"""Proof that the harness itself works, before anything is built on it.

A suite whose fixtures are wrong fails in ways that look like application bugs,
so these check the harness's own promises: the app answers, the migrations'
reference data is there, a write reaches the database, and nothing survives the
test that wrote it.
"""

from http import HTTPStatus

import pytest
from sqlalchemy import text


async def test_application_answers(client):
    response = await client.get('/hc')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {'status': 'ok'}


async def test_authentication_is_overridden(client):
    """A route that reads the caller's identity answers without a token."""
    response = await client.get('/portfolio')

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


async def test_reference_data_from_the_migrations_is_present(db):
    counts = {}
    for table in (
        'asset.asset_type',
        'asset.currency',
        'asset.exchange',
        'portfolio.configuration_name',
    ):
        counts[table] = await db.scalar(text(f'SELECT count(*) FROM {table}'))

    assert all(count > 0 for count in counts.values()), counts


async def test_a_write_lands_and_is_visible_to_the_application(client, db, seed_user_id):
    """The test session and the application's unit of work share one transaction.

    Written here rather than through `POST /portfolio` because that route cannot
    currently succeed — see `test_creating_a_portfolio_over_http` below.
    """
    await db.execute(
        text('INSERT INTO portfolio.portfolio (name, user_id) VALUES (:name, :user_id)'),
        {'name': 'Carteira', 'user_id': seed_user_id},
    )
    await db.commit()

    response = await client.get('/portfolio')

    assert response.status_code == HTTPStatus.OK
    assert [item['name'] for item in response.json()] == ['Carteira']


async def test_nothing_written_by_another_test_survived(db):
    """The rollback is what keeps the test above from leaking into this one.

    If isolation regresses, the portfolio written there is still here.
    """
    remaining = await db.scalar(text('SELECT count(*) FROM portfolio.portfolio'))

    assert remaining == 0


async def test_task_dispatch_does_not_need_a_broker(no_celery):
    assert no_celery['delay'].call_count == 0
    assert no_celery['send_task'].call_count == 0


@pytest.mark.xfail(
    reason=(
        'Portfolio maps `user` as a relationship over the same column as the '
        '`user_id` foreign key, and the dataclass initialises it to None. On '
        'flush the relationship wins and writes NULL into a NOT NULL column, so '
        'creating a portfolio always fails. 39 relationships across the domain '
        'have this shape; where the column is nullable it writes NULL silently '
        'instead of raising.'
    ),
    strict=True,
)
async def test_creating_a_portfolio_over_http(client, db):
    response = await client.post('/portfolio', json={'name': 'Nova', 'user_categories': []})

    assert response.status_code == HTTPStatus.OK, response.text
    name = await db.scalar(
        text('SELECT name FROM portfolio.portfolio WHERE id = :id'), {'id': response.json()}
    )
    assert name == 'Nova'
