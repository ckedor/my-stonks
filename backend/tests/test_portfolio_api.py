# tests/test_portfolio_api.py
"""
E2E tests for the Portfolio API (all sub-routers).
Covers portfolio CRUD, transactions, dividends, categories,
user configuration, and rebalancing.
"""

from datetime import date, datetime
from http import HTTPStatus
from unittest.mock import AsyncMock, patch

import pytest
from app.infra.db.models.asset import Asset
from app.infra.db.models.market_data import Index
from app.infra.db.models.portfolio import (
    Broker,
    CustomCategory,
    Dividend,
    Portfolio,
    Transaction,
)


# ---------------------------------------------------------------------------
# Helpers — seed data directly in the DB
# ---------------------------------------------------------------------------
def _seed_broker(db, name='XP', cnpj='02.332.886/0001-04', currency_id=1):
    broker = Broker(name=name, cnpj=cnpj, currency_id=currency_id)
    db.add(broker)
    db.commit()
    db.refresh(broker)
    return broker


def _seed_asset(db, ticker='PETR4', name='Petrobras', asset_type_id=4, exchange_id=4):
    asset = Asset(ticker=ticker, name=name, asset_type_id=asset_type_id, exchange_id=exchange_id)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


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


def _seed_portfolio(db, name='Carteira Test', user_id=1):
    portfolio = Portfolio(name=name, user_id=user_id)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


# ============================================================================
# PORTFOLIO CRUD
# ============================================================================
class TestPortfolioCRUD:

    @pytest.mark.asyncio
    async def test_create_portfolio(self, client):
        response = await _create_portfolio(client)

        assert response.status_code == HTTPStatus.OK
        # Returns the portfolio id
        assert isinstance(response.json(), int)

    @pytest.mark.asyncio
    async def test_list_portfolios(self, client):
        await _create_portfolio(client, name='Portfolio 1')
        await _create_portfolio(client, name='Portfolio 2')

        response = await client.get('/portfolio')

        assert response.status_code == HTTPStatus.OK
        data = response.json()
        assert len(data) == 2
        names = {p['name'] for p in data}
        assert names == {'Portfolio 1', 'Portfolio 2'}

    @pytest.mark.asyncio
    async def test_list_portfolios_empty(self, client):
        response = await client.get('/portfolio')

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
    async def test_delete_portfolio(self, client):
        create_resp = await _create_portfolio(client)
        portfolio_id = create_resp.json()

        response = await client.delete(f'/portfolio/{portfolio_id}')

        assert response.status_code == HTTPStatus.OK

        list_resp = await client.get('/portfolio')
        assert list_resp.json() == []

    @pytest.mark.asyncio
    async def test_delete_nonexistent_portfolio(self, client):
        response = await client.delete('/portfolio/99999')

        assert response.status_code == HTTPStatus.NOT_FOUND

    @pytest.mark.asyncio
    async def test_create_portfolio_persists_categories(self, client, db):
        create_resp = await _create_portfolio(client)
        portfolio_id = create_resp.json()

        categories = db.query(CustomCategory).filter_by(portfolio_id=portfolio_id).all()
        assert len(categories) == 1
        assert categories[0].name == 'Ações'


# ============================================================================
# TRANSACTIONS
# ============================================================================
class TestTransactions:

    @pytest.mark.asyncio
    async def test_create_transaction(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)
        broker = _seed_broker(db)

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
        txn = db.query(Transaction).filter_by(portfolio_id=portfolio.id).first()
        assert txn is not None
        assert txn.quantity == 100
        assert txn.price == 35.50

    @pytest.mark.asyncio
    async def test_get_transactions(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)
        broker = _seed_broker(db)

        # Create a transaction first
        txn = Transaction(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            broker_id=broker.id,
            date=datetime(2025, 1, 15),
            quantity=100,
            price=35.50,
        )
        db.add(txn)
        db.commit()

        response = await client.get(f'/portfolio/transaction', params={'portfolio_id': portfolio.id})

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_delete_transaction(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)
        broker = _seed_broker(db)

        txn = Transaction(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            broker_id=broker.id,
            date=datetime(2025, 1, 15),
            quantity=50,
            price=30.00,
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)

        response = await client.request(
            'DELETE',
            f'/portfolio/transaction/{txn.id}',
            json={'portfolio_id': portfolio.id, 'asset_id': asset.id},
        )

        assert response.status_code == HTTPStatus.OK
        assert db.query(Transaction).filter_by(id=txn.id).first() is None


# ============================================================================
# DIVIDENDS
# ============================================================================
class TestDividends:

    @pytest.mark.asyncio
    async def test_create_dividend(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)

        payload = {
            'portfolio_id': portfolio.id,
            'asset_id': asset.id,
            'date': '2025-03-15',
            'amount': 1.50,
        }
        response = await client.post('/portfolio/dividend', json=payload)

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_get_dividends(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)

        div = Dividend(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            date=date(2025, 3, 15),
            amount=1.50,
        )
        db.add(div)
        db.commit()

        response = await client.get(f'/portfolio/dividend', params={'portfolio_id': portfolio.id})

        assert response.status_code == HTTPStatus.OK
        data = response.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_update_dividend(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)

        div = Dividend(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            date=date(2025, 3, 15),
            amount=1.50,
        )
        db.add(div)
        db.commit()
        db.refresh(div)

        update_payload = {
            'id': div.id,
            'amount': 2.75,
        }
        response = await client.put(f'/portfolio/dividend/{div.id}', json=update_payload)

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_delete_dividend(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)

        div = Dividend(
            portfolio_id=portfolio.id,
            asset_id=asset.id,
            date=date(2025, 3, 15),
            amount=1.50,
        )
        db.add(div)
        db.commit()
        db.refresh(div)

        response = await client.delete(f'/portfolio/dividend/{div.id}')

        assert response.status_code == HTTPStatus.OK
        assert db.query(Dividend).filter_by(id=div.id).first() is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_dividend(self, client):
        response = await client.delete('/portfolio/dividend/99999')

        assert response.status_code == HTTPStatus.NOT_FOUND


# ============================================================================
# CATEGORIES
# ============================================================================
class TestCategories:

    @pytest.mark.asyncio
    async def test_save_custom_category(self, client, db):
        portfolio = _seed_portfolio(db)

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

        cats = db.query(CustomCategory).filter_by(portfolio_id=portfolio.id).all()
        assert any(c.name == 'FIIs' for c in cats)

    @pytest.mark.asyncio
    async def test_delete_custom_category(self, client, db):
        portfolio = _seed_portfolio(db)
        cat = CustomCategory(
            name='Para Deletar',
            color='#000',
            portfolio_id=portfolio.id,
            benchmark_id=6,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)

        response = await client.delete(f'/portfolio/category/{cat.id}')

        assert response.status_code == HTTPStatus.OK
        assert db.query(CustomCategory).filter_by(id=cat.id).first() is None

    @pytest.mark.asyncio
    async def test_assign_category_to_asset(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)
        cat = CustomCategory(
            name='Ações BR',
            color='#0000FF',
            portfolio_id=portfolio.id,
            benchmark_id=6,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)

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

    @pytest.mark.asyncio
    async def test_get_user_configurations(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(f'/portfolio/user_configuration/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# REBALANCING
# ============================================================================
class TestRebalancing:

    @pytest.mark.asyncio
    async def test_get_rebalancing_empty_portfolio(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(f'/portfolio/rebalancing/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_save_rebalancing_targets(self, client, db):
        portfolio = _seed_portfolio(db)
        asset = _seed_asset(db)
        cat = CustomCategory(
            name='Ações',
            color='#FF0000',
            portfolio_id=portfolio.id,
            benchmark_id=6,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)

        payload = {
            'portfolio_id': portfolio.id,
            'categories': [
                {
                    'category_id': cat.id,
                    'target_percentage': 60.0,
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

    @pytest.mark.asyncio
    async def test_get_portfolio_position(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(f'/portfolio/position/{portfolio.id}')

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_get_portfolio_returns(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(f'/portfolio/position/{portfolio.id}/returns')

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_get_patrimony_evolution(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(f'/portfolio/position/{portfolio.id}/patrimony_evolution')

        assert response.status_code == HTTPStatus.OK


# ============================================================================
# INCOME TAX
# ============================================================================
class TestIncomeTax:

    @pytest.mark.asyncio
    async def test_get_assets_and_rights(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(
            f'/portfolio/income_tax/{portfolio.id}/assets_and_rights',
            params={'fiscal_year': 2024},
        )

        assert response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_get_darf(self, client, db):
        portfolio = _seed_portfolio(db)

        response = await client.get(
            f'/portfolio/income_tax/{portfolio.id}/darf',
            params={'fiscal_year': 2024},
        )

        assert response.status_code == HTTPStatus.OK
