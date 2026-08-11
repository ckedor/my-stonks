# app/modules/portfolio/service/portfolio_dividend_service.py
"""
Portfolio dividend service - handles dividend management.
"""

import pandas as pd
from app.modules.market_data.domain.constants import CURRENCY
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.portfolio.domain.entities import Dividend
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.api.dividend.schema import DividendFilters


class PortfolioDividendService:
    def __init__(self, uow: UnitOfWork, usd_brl_service: UsdBrlReadService):
        self.uow = uow
        self.usd_brl_service = usd_brl_service

    async def _get_usd_brl_rate(self, date) -> tuple[float, float]:
        """Both rate directions in effect on or before ``date``."""
        rate = await self.usd_brl_service.get_rate_on_or_before(pd.Timestamp(date).date())
        return float(rate.usd_brl), float(rate.brl_usd)

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
    ) -> dict:
        usd_brl, brl_usd = await self._get_usd_brl_rate(data['date'])
        currency_id = await self._get_broker_currency(repository, portfolio_id, asset_id)

        if currency_id == CURRENCY.USD:
            data['amount_usd'] = data['amount']
            data['amount'] *= usd_brl
        else:
            data['amount_usd'] = data['amount'] * brl_usd

        return data

    async def get_dividends(
        self,
        portfolio_id: int,
        filters: DividendFilters,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        async with self.uow as uow:
            return await uow.portfolios.get_portfolio_dividends(
                portfolio_id, filters, currency=currency
            )

    async def create_dividend(self, dividend_data):
        async with self.uow as uow:
            data = dividend_data.dict()
            data = await self._fill_dual_currency(
                data,
                data['portfolio_id'],
                data['asset_id'],
                uow.portfolios,
            )
            created = await uow.portfolios.create(Dividend, data)
            await uow.commit()
            return created

    async def update_dividend(self, dividend_data):
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
                )
            updated = await uow.portfolios.update(Dividend, update_data)
            await uow.commit()
            return updated

    async def delete_dividend(self, dividend_id: int):
        async with self.uow as uow:
            existing_dividend = await uow.portfolios.get(Dividend, dividend_id)
            if not existing_dividend:
                return None
            deleted = await uow.portfolios.delete(Dividend, dividend_id)
            await uow.commit()
            return deleted
