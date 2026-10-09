"""Nobody reaches a portfolio that is not theirs.

Every route under `/portfolio` is sent by an intruder, a second user who is not
an administrator, with the owner's ids filled in: the portfolio, a transaction,
a dividend, a category, a DARF payment. Each one has to be refused. The sweep
reads the routes from the application rather than from a list, so a route added
tomorrow is swept too, and one that needs a body nobody wrote down here fails
the test until somebody does — a route is never skipped by omission.

Then come the requests a sweep with the owner's ids cannot express: the
intruder's own portfolio paired with the owner's rows, which is how a check on
the portfolio alone would be walked around.

The last test proves the sweep still bites, by adding a route without the guard
and expecting it to be named.
"""

from dataclasses import dataclass
from http import HTTPStatus

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from fastapi.dependencies.utils import get_flat_dependant
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.entrypoints.http.fastapi_app import create_app
from app.modules.users.domain import User
from app.modules.users.views import current_active_user, current_superuser

pytestmark = pytest.mark.e2e

#: What an intruder may hear back. 403 comes from the administrative routes,
#: which refuse anybody who is not an administrator before looking at the id.
REFUSED = {HTTPStatus.FORBIDDEN, HTTPStatus.NOT_FOUND}

#: Routes that act only on the caller's own records, found by the caller's id:
#: there is no id in them to swap for somebody else's.
OWN_DATA_ROUTES = {
    ('GET', '/portfolio'),
    ('POST', '/portfolio'),
    ('GET', '/portfolio/income_tax/assessment'),
    ('GET', '/portfolio/income_tax/darf_payment'),
    ('POST', '/portfolio/income_tax/darf_payment'),
    ('GET', '/portfolio/wealth_tier'),
}

PDF = {'file': ('documento.pdf', b'%PDF-1.4\n', 'application/pdf')}


@dataclass(frozen=True)
class OwnerData:
    portfolio_id: int
    transaction_id: int
    dividend_id: int
    category_id: int
    payment_id: int
    asset_id: int
    broker_id: int
    asset_type_id: int


@dataclass(frozen=True)
class Intruder:
    http: AsyncClient
    app: FastAPI
    portfolio_id: int
    transaction_id: int


@pytest_asyncio.fixture
async def owner(client, factory) -> OwnerData:
    ids = await factory.ids()
    portfolio = await factory.portfolio(name='Do dono')
    broker = await factory.broker()
    asset = await factory.asset()
    payment = await client.post(
        '/portfolio/income_tax/darf_payment',
        json={
            'revenue_code': '6015',
            'period': '2025-03-01',
            'paid_on': '2025-04-25',
            'principal': '10.00',
        },
    )
    return OwnerData(
        portfolio_id=portfolio,
        transaction_id=await factory.transaction(
            portfolio_id=portfolio, asset_id=asset, broker_id=broker
        ),
        dividend_id=await factory.dividend(portfolio_id=portfolio, asset_id=asset),
        category_id=await factory.category(portfolio_id=portfolio, name='Do dono'),
        payment_id=payment.json()['id'],
        asset_id=asset,
        broker_id=broker,
        asset_type_id=ids.stock_type,
    )


def _refuse_administration():
    raise HTTPException(status_code=HTTPStatus.FORBIDDEN)


@pytest_asyncio.fixture
async def intruder(db, factory, owner) -> Intruder:
    user_id = await db.scalar(
        text(
            'INSERT INTO public."user" '
            '(username, email, hashed_password, is_active, is_superuser, is_verified) '
            "VALUES ('intruder', 'intruder@user.com', 'x', true, false, true) RETURNING id"
        )
    )
    user = User(
        id=user_id,
        username='intruder',
        email='intruder@user.com',
        hashed_password='x',
        is_superuser=False,
    )
    portfolio = await factory.portfolio(name='Do intruso', user_id=user_id)
    transaction = await factory.transaction(
        portfolio_id=portfolio, asset_id=owner.asset_id, broker_id=owner.broker_id
    )

    app = create_app()
    app.dependency_overrides[current_active_user] = lambda: user
    app.dependency_overrides[current_superuser] = _refuse_administration
    # A route that crashes is reported as the 500 it would answer, not raised:
    # the sweep should name every route that let the intruder through, not stop
    # at the first.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url='http://test') as http:
        yield Intruder(http=http, app=app, portfolio_id=portfolio, transaction_id=transaction)


def _path_and_query_values(owner: OwnerData) -> dict[str, object]:
    return {
        'portfolio_id': owner.portfolio_id,
        'transaction_id': owner.transaction_id,
        'dividend_id': owner.dividend_id,
        'category_id': owner.category_id,
        'payment_id': owner.payment_id,
        'asset_id': owner.asset_id,
        'asset_type_id': owner.asset_type_id,
        # The guard answers before the document is looked up, so any id will do.
        'document_id': 1,
        'segment': 'fii',
    }


def _bodies(owner: OwnerData) -> dict[tuple[str, str], dict]:
    """A valid body for every route that takes one, aimed at the owner's rows.

    Valid on purpose: a body the route cannot parse is refused with 422 before
    any guard runs, and would prove nothing.
    """
    portfolio = owner.portfolio_id
    transaction = {
        'portfolio_id': portfolio,
        'asset_id': owner.asset_id,
        'broker_id': owner.broker_id,
        'date': '2024-01-02T00:00:00',
        'quantity': 1,
        'price': 1,
    }
    category = {
        'id': owner.category_id,
        'name': 'Invadida',
        'color': '#000000',
        'benchmark_id': 1,
        'portfolio_id': portfolio,
    }
    return {
        ('PUT', '/portfolio/{portfolio_id}'): {
            'json': {'id': portfolio, 'name': 'Invadida', 'user_categories': []}
        },
        ('POST', '/portfolio/transaction'): {'json': transaction},
        ('PUT', '/portfolio/transaction/{transaction_id}'): {
            'json': {**transaction, 'id': owner.transaction_id}
        },
        ('DELETE', '/portfolio/transaction/{transaction_id}'): {
            'json': {'portfolio_id': portfolio, 'asset_id': owner.asset_id}
        },
        ('POST', '/portfolio/dividend'): {
            'json': {
                'portfolio_id': portfolio,
                'asset_id': owner.asset_id,
                'date': '2024-02-01',
                'amount': 1,
            }
        },
        ('PUT', '/portfolio/dividend/{dividend_id}'): {
            'json': {'id': owner.dividend_id, 'amount': 1}
        },
        ('POST', '/portfolio/category'): {'json': {'categories': [category]}},
        ('POST', '/portfolio/category/assignment'): {
            'json': {
                'asset_id': owner.asset_id,
                'category_id': owner.category_id,
                'portfolio_id': portfolio,
            }
        },
        ('POST', '/portfolio/brokerage_note/extraction'): {
            'data': {'portfolio_id': str(portfolio)},
            'files': PDF,
        },
        ('POST', '/portfolio/brokerage_note/reconciliation'): {
            'json': {'portfolio_id': portfolio, 'lines': []}
        },
        ('POST', '/portfolio/brokerage_note'): {
            'json': {
                'portfolio_id': portfolio,
                'lines': [],
                'note': {
                    'broker_id': owner.broker_id,
                    'trade_date': '2024-01-02',
                    'settlement_date': None,
                    'amounts': {},
                },
                'decisions': [],
            }
        },
        ('POST', '/portfolio/position_statement/extraction'): {
            'data': {'portfolio_id': str(portfolio)},
            'files': PDF,
        },
        ('POST', '/portfolio/position_statement/comparison'): {
            'json': {
                'portfolio_id': portfolio,
                'broker_id': owner.broker_id,
                'as_of': '2024-01-02',
                'holdings': [],
            }
        },
        ('PUT', '/portfolio/user_configuration/{portfolio_id}'): {
            'json': {'configuration': 'fiis_dividends_integration', 'enabled': True}
        },
        ('PUT', '/portfolio/rebalancing/{portfolio_id}'): {
            'json': {
                'portfolio_id': portfolio,
                'categories': [
                    {'category_id': owner.category_id, 'target_percentage': 100, 'assets': []}
                ],
            }
        },
    }


async def _sweep(intruder: Intruder, owner: OwnerData) -> dict[tuple[str, str], int]:
    """Send every portfolio route as the intruder; answer what each one said."""
    values = _path_and_query_values(owner)
    bodies = _bodies(owner)
    routes = [
        (method, route)
        for route in intruder.app.routes
        if isinstance(route, APIRoute) and route.path.startswith('/portfolio')
        for method in route.methods
        if (method, route.path) not in OWN_DATA_ROUTES
    ]
    # Deletes last: one that leaks would take the owner's rows with it, and every
    # route after it would be refused for want of something to show.
    routes.sort(key=lambda item: (item[0] == 'DELETE', item[1].path, item[0]))

    answers = {}
    for method, route in routes:
        key = (method, route.path)
        params = get_flat_dependant(route.dependant)
        missing = [
            p.name
            for p in (*params.path_params, *params.query_params)
            if p.name not in values and (p in params.path_params or p.required)
        ]
        assert not missing, f'{key}: falta um valor para {missing} em _path_and_query_values'
        needs_body = any(p.required for p in params.body_params)
        assert not needs_body or key in bodies, (
            f'{key} recebe corpo e não tem caso em _bodies: escreva um que aponte '
            'para as linhas do dono, ou ponha a rota em OWN_DATA_ROUTES se ela só '
            'age sobre o que é do próprio usuário.'
        )
        path = route.path.format(**{p.name: values[p.name] for p in params.path_params})
        query = {p.name: values[p.name] for p in params.query_params if p.required}
        response = await intruder.http.request(method, path, params=query, **bodies.get(key, {}))
        answers[key] = response.status_code
    return answers


class TestEveryPortfolioRouteRefusesSomebodyElse:
    async def test_no_route_answers_the_intruder(self, intruder, owner):
        answers = await _sweep(intruder, owner)

        answered = {key: status for key, status in answers.items() if status not in REFUSED}
        assert answered == {}
        # The sweep reached the routes it is meant to; an empty app would pass too.
        assert len(answers) > 50

    async def test_nothing_of_the_owner_changed(self, intruder, owner, db):
        await _sweep(intruder, owner)

        portfolio = await db.scalar(
            text('SELECT name FROM portfolio.portfolio WHERE id = :id'),
            {'id': owner.portfolio_id},
        )
        transaction = await db.scalar(
            text('SELECT portfolio_id FROM portfolio.transaction WHERE id = :id'),
            {'id': owner.transaction_id},
        )
        dividend = await db.scalar(
            text('SELECT amount FROM portfolio.dividend WHERE id = :id'),
            {'id': owner.dividend_id},
        )
        category = (
            await db.execute(
                text(
                    'SELECT name, portfolio_id, target_percentage '
                    'FROM portfolio.custom_category WHERE id = :id'
                ),
                {'id': owner.category_id},
            )
        ).one()
        payment = await db.scalar(
            text('SELECT count(*) FROM portfolio.darf_payment WHERE id = :id'),
            {'id': owner.payment_id},
        )

        assert portfolio == 'Do dono'
        assert transaction == owner.portfolio_id
        assert dividend == 50.0
        assert tuple(category) == ('Do dono', owner.portfolio_id, None)
        assert payment == 1


class TestOwnPortfolioDoesNotCarrySomebodyElsesRows:
    """The intruder names their own portfolio, and the owner's rows inside the request."""

    @pytest.fixture
    def requests(self, intruder, owner):
        mine = intruder.portfolio_id
        theirs = owner.portfolio_id
        new_category = {'name': 'Plantada', 'color': '#000000', 'benchmark_id': 1}
        their_category = {**new_category, 'id': owner.category_id, 'portfolio_id': mine}
        transaction = {
            'asset_id': owner.asset_id,
            'broker_id': owner.broker_id,
            'date': '2024-01-02T00:00:00',
            'quantity': 1,
            'price': 1,
        }
        return {
            'pulls their category into my portfolio': (
                'PUT',
                f'/portfolio/{mine}',
                {'id': mine, 'name': 'Minha', 'user_categories': [their_category]},
            ),
            'plants a category in their portfolio': (
                'PUT',
                f'/portfolio/{mine}',
                {
                    'id': mine,
                    'name': 'Minha',
                    'user_categories': [{**new_category, 'portfolio_id': theirs}],
                },
            ),
            'saves their category under my portfolio': (
                'POST',
                '/portfolio/category',
                {'categories': [their_category]},
            ),
            'assigns an asset to their category': (
                'POST',
                '/portfolio/category/assignment',
                {
                    'asset_id': owner.asset_id,
                    'category_id': owner.category_id,
                    'portfolio_id': mine,
                },
            ),
            'moves their transaction into my portfolio': (
                'PUT',
                f'/portfolio/transaction/{owner.transaction_id}',
                {**transaction, 'portfolio_id': mine},
            ),
            'moves my transaction into their portfolio': (
                'PUT',
                f'/portfolio/transaction/{intruder.transaction_id}',
                {**transaction, 'portfolio_id': theirs},
            ),
            'deletes their transaction naming my portfolio': (
                'DELETE',
                f'/portfolio/transaction/{owner.transaction_id}',
                {'portfolio_id': mine, 'asset_id': owner.asset_id},
            ),
            'sets targets on their category through my portfolio': (
                'PUT',
                f'/portfolio/rebalancing/{mine}',
                {
                    'portfolio_id': mine,
                    'categories': [
                        {'category_id': owner.category_id, 'target_percentage': 100, 'assets': []}
                    ],
                },
            ),
        }

    async def test_each_is_refused(self, intruder, requests):
        answers = {
            name: (await intruder.http.request(method, path, json=body)).status_code
            for name, (method, path, body) in requests.items()
        }

        assert answers == dict.fromkeys(requests, HTTPStatus.NOT_FOUND)


async def test_the_sweep_names_a_route_without_the_guard(intruder, owner):
    """Proof that the sweep still bites: an unguarded route is reported."""

    async def leak(portfolio_id: int):
        return {'portfolio_id': portfolio_id}

    intruder.app.add_api_route('/portfolio/leak/{portfolio_id}', leak, methods=['GET'])

    answers = await _sweep(intruder, owner)

    assert answers[('GET', '/portfolio/leak/{portfolio_id}')] == HTTPStatus.OK


async def test_the_owner_still_reaches_their_portfolio(client, owner):
    """The guard refuses the intruder, not everybody."""
    response = await client.get(
        '/portfolio/transaction', params={'portfolio_id': owner.portfolio_id}
    )

    assert response.status_code == HTTPStatus.OK
    assert [row['id'] for row in response.json()] == [owner.transaction_id]
