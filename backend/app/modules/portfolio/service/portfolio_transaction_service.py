# app/modules/portfolio/service/portfolio_transaction_service.py
"""
Portfolio transaction service - handles transaction CRUD and calculations.
"""

import numpy as np
import pandas as pd

from app.infra.db.unit_of_work import UnitOfWork
from app.lib.finance import trade
from app.lib.utils.fastapi import df_response
from app.modules.market_data.domain.constants import CURRENCY
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.portfolio.domain.entities import Transaction


class PortfolioTransactionService:
    def __init__(self, uow: UnitOfWork, usd_brl_service: UsdBrlReadService):
        self.uow = uow
        self.usd_brl_service = usd_brl_service

    async def create_transaction(self, transaction: dict) -> None:
        transaction['date'] = pd.to_datetime(transaction['date']).date()
        async with self.uow as uow:
            await self._with_dual_currency_prices(transaction)
            await uow.portfolios.create(Transaction, transaction)
            await uow.commit()

    async def update_transaction(self, transaction: dict) -> int:
        """Update the transaction and return the portfolio it belonged to before."""
        transaction['date'] = pd.to_datetime(transaction['date']).date()
        async with self.uow as uow:
            old_transaction = await uow.portfolios.get(
                Transaction,
                transaction.get('id'),
                first=True,
            )
            old_portfolio_id = old_transaction.portfolio_id
            await self._with_dual_currency_prices(transaction)
            await uow.portfolios.update(Transaction, transaction)
            await uow.commit()
        return old_portfolio_id

    async def delete_transaction(self, transaction_id) -> None:
        async with self.uow as uow:
            await uow.portfolios.delete(Transaction, id=transaction_id)
            await uow.commit()

    async def get_transactions(
        self,
        portfolio_id: int,
        asset_id: int | None = None,
        asset_types_ids: list[int] | None = None,
        currency_id: int | None = None,
    ) -> pd.DataFrame:
        async with self.uow as uow:
            rows = await uow.portfolios.get_transactions(
                portfolio_id,
                asset_id,
                asset_types_ids,
                currency_id,
            )
        if not rows:
            return df_response(pd.DataFrame())

        transactions_df = pd.DataFrame(rows)
        transactions_df['date'] = pd.to_datetime(transactions_df['date'])

        transactions_df['original_price'] = np.where(
            transactions_df['currency_id'] == CURRENCY.USD,
            transactions_df['price_usd'],
            transactions_df['price'],
        )
        transactions_df['currency'] = np.where(
            transactions_df['currency_id'] == CURRENCY.USD, 'USD', 'BRL'
        )

        transactions_df = (
            transactions_df.sort_values(by=['asset_id', 'date'])
            .groupby('asset_id', group_keys=False)
            .apply(trade.profit_by_trade_df)
        )
        transactions_df['type'] = np.where(transactions_df['quantity'] > 0, 'Compra', 'Venda')

        transactions_df['value'] = transactions_df['quantity'] * transactions_df['price']
        transactions_df['acc_quantity'] = transactions_df.groupby('asset_id')['quantity'].cumsum()
        transactions_df['position'] = transactions_df['acc_quantity'] * transactions_df['price']
        transactions_df['profit_pct'] = np.where(
            transactions_df['type'] == 'Venda',
            (transactions_df['realized_profit'] / abs(transactions_df['value'])) * 100,
            np.nan,
        )
        transactions_df['portfolio_id'] = portfolio_id
        transactions_df.sort_values(by=['date'], inplace=True)
        return df_response(transactions_df)

    async def _with_dual_currency_prices(self, transaction: dict) -> None:
        """Populate `price` (BRL) and `price_usd` from the user-supplied price + currency.

        The transaction dict is mutated in place. Removes the `currency` key since it
        is not a column on Transaction.
        """
        currency = transaction.pop('currency', 'BRL')
        original_price = float(transaction['price'])
        usd_brl, brl_usd = await self._get_usd_brl_on(transaction['date'])

        if currency == 'USD':
            transaction['price'] = original_price * usd_brl
            transaction['price_usd'] = original_price
        else:
            transaction['price'] = original_price
            transaction['price_usd'] = original_price * brl_usd

    async def _get_usd_brl_on(self, date) -> tuple[float, float]:
        """Both rate directions in effect on or before ``date``."""
        rate = await self.usd_brl_service.get_rate_on_or_before(pd.Timestamp(date).date())
        return float(rate.usd_brl), float(rate.brl_usd)
