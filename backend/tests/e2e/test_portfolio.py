# tests/test_portfolio_api.py
"""
E2E tests for the Portfolio API (all sub-routers).
Covers portfolio CRUD, transactions, dividends, categories,
user configuration, and rebalancing.
"""

from datetime import date, datetime
from http import HTTPStatus

from sqlalchemy import select

from app.modules.portfolio.domain.entities import (
    CustomCategory,
    Dividend,
    Transaction,
)


# ---------------------------------------------------------------------------
# Helpers — seed data directly in the DB
# ---------------------------------------------------------------------------
class _Row:
    """Just an id, so the call sites that read `.id` keep reading `.id`."""

    def __init__(self, id):
        self.id = id


async def _seed_broker(factory, name='XP', cnpj='02.332.886/0001-04', currency_id=1):
    return _Row(await factory.broker(name=name, cnpj=cnpj, currency_id=currency_id))


async def _seed_asset(factory, ticker='PETR4', name='Petrobras'):
    return _Row(await factory.asset(ticker=ticker, name=name))


async def _create_portfolio(client, name='Carteira Principal', benchmark_id=6):
    """Create a portfolio via the API (needs at least one category)."""
    payload = {
        'name': name,
        'user_categories': [
            {
                'name': 'Ações',
                'color': '#FF0000',
                'benchmark_id': benchmark_id,
            }
        ],
    }
    return await client.post('/portfolio', json=payload)


async def _seed_portfolio(factory, name='Carteira Test'):
    return _Row(await factory.portfolio(name=name))


# ============================================================================
# PORTFOLIO CRUD
# ============================================================================
class TestPortfolioCRUD:
    async def test_create_portfolio(self, client):
        response = await _create_portfolio(client)

        assert response.status_code == HTTPStatus.OK
        # Returns the portfolio id
        assert isinstance(response.json(), int)

    async def test_list_portfolios(self, client):
        await _create_portfolio(client, name='Portfolio 1')
        await _create_portfolio(client, name='Portfolio 2')

        response = await client.get('/portfolio')

        assert response.status_code == HTTPStatus.OK
        data = response.json()
        assert len(data) == 2
        names = {p['name'] for p in data}
        assert names == {'Portfolio 1', 'Portfolio 2'}

    async def test_list_portfolios_empty(self, client):
        response = await client.get('/portfolio')

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    async def test_update_portfolio(self, client):
        create_resp = await _create_portfolio(client)
        portfolio_id = create_resp.json()

        update_payload = {
            'id': portfolio_id,
            'name': 'Nome Atualizado',
            'user_categories': [],
        }
        response = await client.put(f'/portfolio/{portfolio_id}', json=update_payload)

        assert response.status_code == HTTPStatus.OK
        assert response.json()['message'] == 'Portfolio updated successfully.'

        # Verify name changed
        list_resp = await client.get('/portfolio')
        names = [p['name'] for p in list_resp.json()]
        assert 'Nome Atualizado' in names

    async def test_delete_portfolio(self, client):
        create_resp = await _create_portfolio(client)
        portfolio_id = create_resp.json()

        response = await client.delete(f'/portfolio/{portfolio_id}')

        assert response.status_code == HTTPStatus.OK

        list_resp = await client.get('/portfolio')
        assert list_resp.json() == []

    async def test_delete_nonexistent_portfolio(self, client):
        response = await client.delete('/portfolio/99999')

        assert response.status_code == HTTPStatus.NOT_FOUND

    async def test_create_portfolio_persists_categories(self, client, db):
        create_resp = await _create_portfolio(client)
        portfolio_id = create_resp.json()

        categories = (
            await db.scalars(select(CustomCategory).filter_by(portfolio_id=portfolio_id))
        ).all()
        assert len(categories) == 1
        assert categories[0].name == 'Ações'


# ============================================================================
# TRANSACTIONS
# ============================================================================
class TestTransactions:
    async def test_create_transaction(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)
        broker = await _seed_broker(factory)

        payload = {
            'portfolio_id': portfolio.id,
            'asset_id': asset.id,
            'broker_id': broker.id,
            'date': '2025-01-15T00:00:00',
            'quantity': 100,
            'price': 35.50,
        }
        response = await client.post('/portfolio/transaction', json=payload)

        assert response.status_code == HTTPStatus.OK

        # Verify persisted
        txn = await db.scalar(select(Transaction).filter_by(portfolio_id=portfolio.id))
        assert txn is not None
        assert txn.quantity == 100
        assert txn.price == 35.50

    async def test_get_transactions(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)
        broker = await _seed_broker(factory)

        # Create a transaction first
        _Row(
            await factory.transaction(
                portfolio_id=portfolio.id,
                asset_id=asset.id,
                broker_id=broker.id,
                on=datetime(2025, 1, 15),
                quantity=100,
                price=35.50,
            )
        )

        response = await client.get('/portfolio/transaction', params={'portfolio_id': portfolio.id})

        assert response.status_code == HTTPStatus.OK

    async def test_delete_transaction(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)
        broker = await _seed_broker(factory)

        txn = _Row(
            await factory.transaction(
                portfolio_id=portfolio.id,
                asset_id=asset.id,
                broker_id=broker.id,
                on=datetime(2025, 1, 15),
                quantity=50,
                price=30.00,
            )
        )

        response = await client.request(
            'DELETE',
            f'/portfolio/transaction/{txn.id}',
            json={'portfolio_id': portfolio.id, 'asset_id': asset.id},
        )

        assert response.status_code == HTTPStatus.OK
        assert await db.scalar(select(Transaction).filter_by(id=txn.id)) is None


# ============================================================================
# DIVIDENDS
# ============================================================================
class TestDividends:
    async def test_create_dividend(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)

        payload = {
            'portfolio_id': portfolio.id,
            'asset_id': asset.id,
            'date': '2025-03-15',
            'amount': 1.50,
        }
        response = await client.post('/portfolio/dividend', json=payload)

        assert response.status_code == HTTPStatus.OK

    async def test_get_dividends(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)

        _Row(
            await factory.dividend(
                portfolio_id=portfolio.id,
                asset_id=asset.id,
                on=date(2025, 3, 15),
                amount=1.50,
            )
        )

        response = await client.get('/portfolio/dividend', params={'portfolio_id': portfolio.id})

        assert response.status_code == HTTPStatus.OK
        data = response.json()
        assert len(data) >= 1

    async def test_update_dividend(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)

        div = _Row(
            await factory.dividend(
                portfolio_id=portfolio.id,
                asset_id=asset.id,
                on=date(2025, 3, 15),
                amount=1.50,
            )
        )

        update_payload = {
            'id': div.id,
            'amount': 2.75,
        }
        response = await client.put(f'/portfolio/dividend/{div.id}', json=update_payload)

        assert response.status_code == HTTPStatus.OK

    async def test_delete_dividend(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)

        div = _Row(
            await factory.dividend(
                portfolio_id=portfolio.id,
                asset_id=asset.id,
                on=date(2025, 3, 15),
                amount=1.50,
            )
        )

        response = await client.delete(f'/portfolio/dividend/{div.id}')

        assert response.status_code == HTTPStatus.OK
        assert await db.scalar(select(Dividend).filter_by(id=div.id)) is None

    async def test_delete_nonexistent_dividend(self, client):
        response = await client.delete('/portfolio/dividend/99999')

        assert response.status_code == HTTPStatus.NOT_FOUND


# ============================================================================
# CATEGORIES
# ============================================================================
class TestCategories:
    async def test_save_custom_category(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        payload = {
            'categories': [
                {
                    'name': 'FIIs',
                    'color': '#00FF00',
                    'portfolio_id': portfolio.id,
                    'benchmark_id': 4,  # IFIX
                },
            ],
        }
        response = await client.post('/portfolio/category', json=payload)

        assert response.status_code == HTTPStatus.OK

        cats = (await db.scalars(select(CustomCategory).filter_by(portfolio_id=portfolio.id))).all()
        assert any(c.name == 'FIIs' for c in cats)

    async def test_delete_custom_category(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        cat = _Row(
            await factory.category(
                name='Para Deletar',
                portfolio_id=portfolio.id,
                benchmark_id=6,
            )
        )

        response = await client.delete(f'/portfolio/category/{cat.id}')

        assert response.status_code == HTTPStatus.OK
        assert await db.scalar(select(CustomCategory).filter_by(id=cat.id)) is None

    async def test_assign_category_to_asset(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)
        cat = _Row(
            await factory.category(
                name='Ações BR',
                portfolio_id=portfolio.id,
                benchmark_id=6,
            )
        )

        payload = {
            'asset_id': asset.id,
            'category_id': cat.id,
            'portfolio_id': portfolio.id,
        }
        response = await client.post('/portfolio/category/assignment', json=payload)

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# USER CONFIGURATION
# ============================================================================
class TestUserConfiguration:
    async def test_get_user_configurations(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(f'/portfolio/user_configuration/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# REBALANCING
# ============================================================================
class TestRebalancing:
    async def test_get_rebalancing_empty_portfolio(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(f'/portfolio/rebalancing/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK

    async def test_save_rebalancing_targets(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        asset = await _seed_asset(factory)
        cat = _Row(
            await factory.category(
                name='Ações',
                portfolio_id=portfolio.id,
                benchmark_id=6,
            )
        )

        payload = {
            'portfolio_id': portfolio.id,
            'categories': [
                {
                    # A regra do serviço exige que as categorias somem 100%.
                    'category_id': cat.id,
                    'target_percentage': 100.0,
                    'assets': [
                        {
                            'asset_id': asset.id,
                            'target_percentage': 100.0,
                        }
                    ],
                }
            ],
        }
        response = await client.put(
            f'/portfolio/rebalancing/{portfolio.id}',
            json=payload,
        )

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# POSITION (read-only endpoints, need seeded positions)
# ============================================================================
class TestPosition:
    async def test_get_portfolio_position(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(f'/portfolio/position/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK

    async def test_get_portfolio_returns(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(f'/portfolio/position/{portfolio.id}/returns')

        assert response.status_code == HTTPStatus.OK

    async def test_get_asset_type_returns(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)
        fii_type = (await factory.ids()).fii_type

        response = await client.get(
            f'/portfolio/position/{portfolio.id}/asset-type/{fii_type}/returns'
        )

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    async def test_get_patrimony_evolution(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(f'/portfolio/position/{portfolio.id}/patrimony_evolution')

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# INCOME TAX
# ============================================================================
class TestIncomeTax:
    async def test_get_assets_and_rights(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(
            f'/portfolio/income_tax/{portfolio.id}/assets_and_rights',
            params={'fiscal_year': 2024},
        )

        assert response.status_code == HTTPStatus.OK

    async def test_get_darf(self, client, db, factory):
        portfolio = await _seed_portfolio(factory)

        response = await client.get(
            f'/portfolio/income_tax/{portfolio.id}/darf',
            params={'fiscal_year': 2024},
        )

        assert response.status_code == HTTPStatus.OK
