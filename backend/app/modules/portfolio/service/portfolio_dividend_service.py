# app/modules/portfolio/service/portfolio_dividend_service.py
"""
Portfolio dividend service - handles dividend management.
"""

import pandas as pd
from app.modules.market_data.domain.constants import CURRENCY
from app.modules.portfolio.domain.entities import Dividend
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.api.dividend.schema import DividendFilters
from app.modules.portfolio.repositories import PortfolioRepository


class PortfolioDividendService:
    def __init__(
        self,
        *,
        market_data_service: MarketDataService,
        repository: PortfolioRepository | None = None,
        uow: UnitOfWork | None = None,
    ):
        self.market_data_service = market_data_service
        self.repository = repository
        self.uow = uow

    async def _get_usdbrl_rate(self, date, market_data_repository) -> float:
        df = await self.market_data_service.get_usd_brl_history(
            start_date=pd.Timestamp(date) - pd.DateOffset(days=10),
            repository=market_data_repository,
        )
        df = df.sort_values('date')
        df = df[df['date'] <= pd.Timestamp(date)]
        if df.empty:
            raise ValueError(f'USD/BRL rate not found for date {date}')
        return float(df.iloc[-1]['usdbrl'])

    @staticmethod
    async def _get_broker_currency(
        repository: PortfolioRepository,
        portfolio_id: int,
        asset_id: int,
    ) -> int:
        currency_id = await repository.get_broker_currency_for_asset(
            portfolio_id,
            asset_id,
        )
        return currency_id or CURRENCY.BRL

    async def _fill_dual_currency(
        self,
        data: dict,
        portfolio_id: int,
        asset_id: int,
        repository: PortfolioRepository,
        market_data_repository,
    ) -> dict:
        rate = await self._get_usdbrl_rate(data['date'], market_data_repository)
        currency_id = await self._get_broker_currency(repository, portfolio_id, asset_id)

        if currency_id == CURRENCY.USD:
            data['amount_usd'] = data['amount']
            data['amount'] *= rate
        else:
            data['amount_usd'] = data['amount'] / rate

        return data

    async def get_dividends(
        self,
        portfolio_id: int,
        filters: DividendFilters,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        dividends = await self.repository.get_portfolio_dividends(
            portfolio_id, filters, currency=currency
        )
        return dividends

    async def create_dividend(self, dividend_data):
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        async with self.uow as uow:
            data = dividend_data.dict()
            data = await self._fill_dual_currency(
                data,
                data['portfolio_id'],
                data['asset_id'],
                uow.portfolios,
                uow.market_data,
            )
            return await uow.portfolios.create(Dividend, data)

    async def update_dividend(self, dividend_data):
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        async with self.uow as uow:
            existing_dividend = await uow.portfolios.get(Dividend, dividend_data.id)
            if not existing_dividend:
                return None

            update_data = dividend_data.dict(exclude_unset=True)
            if 'amount' in update_data:
                update_data['date'] = update_data.get('date', existing_dividend.date)
                update_data = await self._fill_dual_currency(
                    update_data,
                    existing_dividend.portfolio_id,
                    existing_dividend.asset_id,
                    uow.portfolios,
                    uow.market_data,
                )
            return await uow.portfolios.update(Dividend, update_data)

    async def delete_dividend(self, dividend_id: int):
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        async with self.uow as uow:
            existing_dividend = await uow.portfolios.get(Dividend, dividend_id)
            if not existing_dividend:
                return None
            return await uow.portfolios.delete(Dividend, dividend_id)
