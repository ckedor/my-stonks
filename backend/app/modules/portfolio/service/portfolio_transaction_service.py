# app/modules/portfolio/service/portfolio_transaction_service.py
"""
Portfolio transaction service - handles transaction CRUD and calculations.
"""

from typing import List

import numpy as np
import pandas as pd
from app.entrypoints.worker.task_runner import run_task
from app.infra.db.models.constants.currency import CURRENCY
from app.infra.db.models.portfolio import Transaction
from app.lib.finance import trade
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.tasks.recalculate_asset_position import (
    recalculate_position_asset,
)
from app.utils.response import df_response


class PortfolioTransactionService:
    def __init__(self, session):
        self.session = session
        self.repo = PortfolioRepository(session)
        self.market_data_service = MarketDataService(session)

    async def create_transaction(self, transaction: dict) -> None:
        transaction['date'] = pd.to_datetime(transaction['date']).date()
        await self.repo.create(Transaction, transaction)
        await self.session.commit()

    async def get_transactions(self, portfolio_id: int, asset_id: int = None, asset_types_ids: List[int] = None, currency_id: int = None) -> pd.DataFrame:
        transactions_df = await self.repo.get_transactions_df(portfolio_id, asset_id, asset_types_ids, currency_id)
        transactions_df['original_price'] = transactions_df['price'].copy()
        
        transactions_df = await self._normalize_to_brl(transactions_df)

        transactions_df = (
            transactions_df
                .sort_values(by=['asset_id', 'date'])
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

    async def _normalize_to_brl(self, transactions_df):
        usdbrl_df = await self.market_data_service.get_usd_brl_history()
        transactions_df = transactions_df.merge(usdbrl_df, on='date', how='left')
        transactions_df.loc[transactions_df["currency_id"] == CURRENCY.USD, "price"] = (
            transactions_df["price"] * transactions_df["usdbrl"]
        )
        return transactions_df

    async def update_transaction(self, transaction: dict) -> None:
        old_portfolio = await self.repo.get(Transaction, transaction.get('id'), first=True)
        old_portfolio_id = old_portfolio.portfolio_id

        transaction['date'] = pd.to_datetime(transaction['date']).date()
        await self.repo.update(Transaction, transaction)
        await self.session.commit()
            
        run_task(recalculate_position_asset, transaction['portfolio_id'], transaction['asset_id'])
        if transaction['portfolio_id'] != old_portfolio_id:
            run_task(recalculate_position_asset, old_portfolio_id, transaction['asset_id'])

    async def delete_transaction(self, transaction_id) -> None:
        await self.repo.delete(Transaction, id=transaction_id)
        await self.session.commit()