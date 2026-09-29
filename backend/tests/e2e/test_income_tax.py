"""A apuração do IR pela API, contra o banco de verdade.

O que só este nível prova: que a consulta junta as carteiras do usuário — e só
as dele —, que o custo de uma compra numa carteira mede a venda feita noutra, e
que um pagamento registrado muda o estado do DARF na leitura seguinte.
"""

from datetime import date
from http import HTTPStatus

from sqlalchemy import text

B3 = 'B3'
STOCK_TYPE_ID = 4


async def _stock(db, ticker: str) -> int:
    exchange_id = await db.scalar(
        text('SELECT id FROM asset.exchange WHERE code = :code'), {'code': B3}
    )
    return await db.scalar(
        text(
            'INSERT INTO asset.asset (ticker, name, asset_type_id, exchange_id) '
            'VALUES (:ticker, :ticker, :type_id, :exchange_id) RETURNING id'
        ),
        {'ticker': ticker, 'type_id': STOCK_TYPE_ID, 'exchange_id': exchange_id},
    )


async def _trade(db, *, portfolio_id, asset_id, broker_id, quantity, price, on, fees=None):  # noqa: PLR0913
    await db.execute(
        text(
            'INSERT INTO portfolio.transaction '
            '(portfolio_id, asset_id, broker_id, quantity, price, date, fees) '
            'VALUES (:portfolio_id, :asset_id, :broker_id, :quantity, :price, :on, :fees)'
        ),
        {
            'portfolio_id': portfolio_id,
            'asset_id': asset_id,
            'broker_id': broker_id,
            'quantity': quantity,
            'price': price,
            'on': on,
            'fees': fees,
        },
    )


async def _other_user(db) -> int:
    return await db.scalar(
        text(
            'INSERT INTO public."user" '
            '(username, email, hashed_password, is_active, is_superuser, is_verified) '
            "VALUES ('other', 'other@user.com', 'x', true, false, true) RETURNING id"
        )
    )


def _common_march(body: dict) -> dict:
    (common,) = [regime for regime in body['regimes'] if regime['regime'] == 'common']
    return common['months'][2]


async def _seed_sale_across_portfolios(db, factory):
    """Compra 100 PETR4 a 100 numa carteira, vende a 300 noutra: ganho 20.000."""
    broker = await factory.broker(name='XP')
    asset = await _stock(db, 'PETR4')
    first = await factory.portfolio(name='Principal')
    second = await factory.portfolio(name='Outra')
    await _trade(
        db,
        portfolio_id=first,
        asset_id=asset,
        broker_id=broker,
        quantity=100,
        price=100,
        on=date(2025, 3, 3),
        fees=0,
    )
    await _trade(
        db,
        portfolio_id=second,
        asset_id=asset,
        broker_id=broker,
        quantity=-100,
        price=300,
        on=date(2025, 3, 20),
        fees=0,
    )
    return asset, broker


class TestAssessment:
    async def test_the_assessment_joins_every_portfolio_of_the_user(self, client, db, factory):
        await _seed_sale_across_portfolios(db, factory)

        response = await client.get(
            '/portfolio/income_tax/assessment', params={'fiscal_year': 2025}
        )

        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert body['filing_year'] == 2026
        march = _common_march(body)
        # 30.000 de venda, custo 10.000 da outra carteira: ganho 20.000 × 15%.
        assert march['sales'] == '30000.00'
        assert march['tax_due'] == '3000.00'
        (darf,) = body['obligations']
        assert darf['revenue_code'] == '6015'
        assert darf['due_date'] == '2025-04-30'
        assert body['pendencies'] == []

    async def test_another_users_portfolio_stays_out(self, client, db, factory):
        broker = await factory.broker(name='XP')
        asset = await _stock(db, 'VALE3')
        foreign = await factory.portfolio(name='Alheia', user_id=await _other_user(db))
        await _trade(
            db,
            portfolio_id=foreign,
            asset_id=asset,
            broker_id=broker,
            quantity=-100,
            price=300,
            on=date(2025, 3, 20),
            fees=0,
        )

        response = await client.get(
            '/portfolio/income_tax/assessment', params={'fiscal_year': 2025}
        )

        assert _common_march(response.json())['sales'] == '0.00'

    async def test_a_year_without_trades_answers_twelve_empty_months(self, client):
        response = await client.get(
            '/portfolio/income_tax/assessment', params={'fiscal_year': 2024}
        )

        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert [len(regime['months']) for regime in body['regimes']] == [12, 12, 12]
        assert body['obligations'] == []


class TestDarfPayment:
    async def test_a_registered_payment_settles_the_darf(self, client, db, factory):
        await _seed_sale_across_portfolios(db, factory)

        created = await client.post(
            '/portfolio/income_tax/darf_payment',
            json={
                'revenue_code': '6015',
                'period': '2025-03-15',
                'paid_on': '2025-04-25',
                'principal': '3000.00',
            },
        )
        assessment = await client.get(
            '/portfolio/income_tax/assessment', params={'fiscal_year': 2025}
        )

        assert created.status_code == HTTPStatus.CREATED
        assert created.json()['period'] == '2025-03-01'
        (darf,) = assessment.json()['obligations']
        assert darf['status'] == 'paid'
        assert darf['balance'] == '0.00'

    async def test_a_payment_can_be_removed_once(self, client):
        created = await client.post(
            '/portfolio/income_tax/darf_payment',
            json={
                'revenue_code': '6015',
                'period': '2025-03-01',
                'paid_on': '2025-04-25',
                'principal': '10.00',
            },
        )
        payment_id = created.json()['id']

        first = await client.delete(f'/portfolio/income_tax/darf_payment/{payment_id}')
        second = await client.delete(f'/portfolio/income_tax/darf_payment/{payment_id}')
        listed = await client.get('/portfolio/income_tax/darf_payment')

        assert first.status_code == HTTPStatus.NO_CONTENT
        assert second.status_code == HTTPStatus.NOT_FOUND
        assert listed.json() == []

    async def test_a_payment_without_principal_is_refused(self, client):
        response = await client.post(
            '/portfolio/income_tax/darf_payment',
            json={
                'revenue_code': '6015',
                'period': '2025-03-01',
                'paid_on': '2025-04-25',
                'principal': '0',
            },
        )

        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


class TestDeclaration:
    async def test_a_jcp_registered_through_the_api_goes_to_exclusive_taxation(
        self, client, db, factory
    ):
        broker = await factory.broker(name='XP')
        asset = await _stock(db, 'ITUB4')
        portfolio = await factory.portfolio(name='Principal')
        await _trade(
            db,
            portfolio_id=portfolio,
            asset_id=asset,
            broker_id=broker,
            quantity=100,
            price=30,
            on=date(2024, 3, 3),
            fees=0,
        )

        created = await client.post(
            '/portfolio/dividend',
            json={
                'portfolio_id': portfolio,
                'asset_id': asset,
                'date': '2025-05-10',
                'amount': 42.5,
                'kind': 'interest_on_equity',
            },
        )
        body = (
            await client.get('/portfolio/income_tax/assessment', params={'fiscal_year': 2025})
        ).json()

        assert created.status_code == HTTPStatus.OK
        (jcp,) = body['exclusive_income']
        assert (jcp['code'], jcp['amount']) == ('10', '42.50')
        assert body['exempt_income'] == []
        (item,) = body['assets_and_rights']
        assert (item['group'], item['code'], item['current_value']) == ('03', '01', '3000.00')
