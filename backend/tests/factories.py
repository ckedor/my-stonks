"""Builders for the rows a test needs, so each test states only what it cares about.

Every builder takes an open session, writes one row and returns its id, filling
the rest with defaults that satisfy the schema. A test that needs a portfolio
asks for a portfolio; the currency, the asset type and the exchange it happens
to hang off are somebody else's problem.

They insert with SQL rather than through the ORM on purpose. Building a fresh
mapped entity and flushing it hits the relationship-over-foreign-key defect
recorded in plan.md — the relationship initialises to None and overwrites the
column — so an ORM-based factory would fail for reasons that have nothing to do
with the test using it. Setup has to be the part that always works.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

BRL = 1
USD = 2


@dataclass(frozen=True)
class Ids:
    """Reference rows the migrations seed, looked up once per factory."""

    stock_type: int
    fii_type: int
    exchange: int


class Factory:
    def __init__(self, session: AsyncSession, user_id: int):
        self.session = session
        self.user_id = user_id

    async def _scalar(self, sql: str, **params):
        return await self.session.scalar(text(sql), params)

    async def ids(self) -> Ids:
        return Ids(
            stock_type=await self._scalar(
                "SELECT id FROM asset.asset_type WHERE short_name = 'ACAO'"
            )
            or await self._scalar('SELECT min(id) FROM asset.asset_type'),
            fii_type=await self._scalar("SELECT id FROM asset.asset_type WHERE short_name = 'FII'")
            or await self._scalar('SELECT min(id) FROM asset.asset_type'),
            exchange=await self._scalar('SELECT min(id) FROM asset.exchange'),
        )

    async def portfolio(self, *, name: str = 'Carteira', user_id: int | None = None) -> int:
        return await self._scalar(
            'INSERT INTO portfolio.portfolio (name, user_id) VALUES (:name, :user_id) RETURNING id',
            name=name,
            user_id=user_id if user_id is not None else self.user_id,
        )

    async def broker(
        self,
        *,
        name: str = 'Corretora',
        cnpj: str | None = None,
        currency_id: int = BRL,
    ) -> int:
        return await self._scalar(
            'INSERT INTO portfolio.broker (name, cnpj, currency_id) '
            'VALUES (:name, :cnpj, :currency_id) RETURNING id',
            name=name,
            cnpj=cnpj,
            currency_id=currency_id,
        )

    async def asset(
        self,
        *,
        ticker: str = 'PETR4',
        name: str = 'Petrobras',
        asset_type_id: int | None = None,
        exchange_id: int | None = None,
    ) -> int:
        ids = await self.ids()
        return await self._scalar(
            'INSERT INTO asset.asset (ticker, name, asset_type_id, exchange_id) '
            'VALUES (:ticker, :name, :asset_type_id, :exchange_id) RETURNING id',
            ticker=ticker,
            name=name,
            asset_type_id=asset_type_id if asset_type_id is not None else ids.stock_type,
            exchange_id=exchange_id if exchange_id is not None else ids.exchange,
        )

    async def category(
        self,
        *,
        portfolio_id: int,
        name: str = 'Ações',
        color: str = '#123456',
        benchmark_id: int | None = None,
        target_percentage: float | None = None,
    ) -> int:
        return await self._scalar(
            'INSERT INTO portfolio.custom_category '
            '(name, portfolio_id, color, benchmark_id, target_percentage) '
            'VALUES (:name, :portfolio_id, :color, :benchmark_id, :target_percentage) '
            'RETURNING id',
            name=name,
            portfolio_id=portfolio_id,
            color=color,
            benchmark_id=benchmark_id,
            target_percentage=target_percentage,
        )

    async def transaction(  # noqa: PLR0913
        self,
        *,
        portfolio_id: int,
        asset_id: int,
        broker_id: int,
        quantity: float = 100.0,
        price: float = 10.0,
        on: date | None = None,
    ) -> int:
        return await self._scalar(
            'INSERT INTO portfolio.transaction '
            '(portfolio_id, asset_id, broker_id, quantity, price, date) '
            'VALUES (:portfolio_id, :asset_id, :broker_id, :quantity, :price, :on) '
            'RETURNING id',
            portfolio_id=portfolio_id,
            asset_id=asset_id,
            broker_id=broker_id,
            quantity=quantity,
            price=price,
            on=on or date(2024, 1, 2),
        )

    async def usd_brl_rate(
        self,
        *,
        on: date | None = None,
        usd_brl: float = 5.0,
    ) -> date:
        """One day of the USD/BRL table.

        Anything that records money reads this: a transaction and a dividend are
        both stored in the two currencies, so without a rate on or before their
        date the write fails with "USD/BRL history not found". Tests that only
        care about the row they are creating get one from `seed_rate`.
        """
        on = on or date(2020, 1, 1)
        await self.session.execute(
            text(
                'INSERT INTO market_data.usd_brl_history (date, usd_brl, brl_usd, source) '
                'VALUES (:on, :usd_brl, :brl_usd, :source) ON CONFLICT (date) DO NOTHING'
            ),
            {'on': on, 'usd_brl': usd_brl, 'brl_usd': 1 / usd_brl, 'source': 'test'},
        )
        return on

    async def dividend(
        self,
        *,
        portfolio_id: int,
        asset_id: int,
        amount: float = 50.0,
        on: date | None = None,
    ) -> int:
        return await self._scalar(
            'INSERT INTO portfolio.dividend (portfolio_id, asset_id, amount, date) '
            'VALUES (:portfolio_id, :asset_id, :amount, :on) RETURNING id',
            portfolio_id=portfolio_id,
            asset_id=asset_id,
            amount=amount,
            on=on or date(2024, 2, 1),
        )
