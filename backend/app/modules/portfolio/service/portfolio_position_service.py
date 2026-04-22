# app/modules/portfolio/service/portfolio_position_service.py
"""
Portfolio position service - handles position queries and analysis.
"""

import datetime
from typing import Any

import numpy as np
import pandas as pd
from app.core.exceptions import NotFoundError
from app.infra.db.models.constants.currency import CURRENCY
from app.infra.db.models.constants.index import INDEX
from app.infra.db.models.portfolio import Position
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.asset.api.schemas import AssetDetailsOut, AssetDetailsWithPosition
from app.modules.market_data.service.market_data_service import MarketDataService
from app.modules.portfolio.domain.asset_analysis import calculate_returns_analysis
from app.modules.portfolio.domain.returns import (
    calculate_asset_acc_returns,
    calculate_portfolio_daily_returns,
    calculate_returns_portfolio,
)
from app.modules.portfolio.repositories import PortfolioRepository
from app.utils.df import df_to_dict_list, df_to_named_dict
from app.utils.response import df_response


class PortfolioPositionService:
    def __init__(self, session):
        self.session = session
        self.repo = PortfolioRepository(session)
        self.market_data_service = MarketDataService(session)
        self.cache = RedisService()

    async def get_asset_details(self, portfolio_id: int, asset_id: int = None, currency: str = 'BRL') -> dict:
        asset = await self.repo.get_asset_details(asset_id)
        if not asset:
            raise NotFoundError('Ativo não encontrado')

        position = await self.repo.get(
            Position,
            by={'portfolio_id': portfolio_id, 'asset_id': asset_id},
            order_by='date desc',
            first=True,
        )

        suffix = '_usd' if currency == 'USD' else ''
        price = getattr(position, f'price{suffix}')
        average_price = getattr(position, f'average_price{suffix}')
        acc_return_val = getattr(position, f'acc_return{suffix}')
        twelve_months_val = getattr(position, f'twelve_months_return{suffix}')
        cagr_val = getattr(position, f'cagr{suffix}')

        asset_serialized = AssetDetailsOut.model_validate(asset).model_dump()
        asset_serialized_with_position = {
            **asset_serialized,
            'quantity': position.quantity,
            'price': price,
            'average_price': average_price,
            'value': (position.quantity * price),
            'acc_return': (None if pd.isna(acc_return_val) else acc_return_val),
            'twelve_months_return': (
                None if pd.isna(twelve_months_val) else twelve_months_val
            ),
            'cagr': (None if pd.isna(cagr_val) else cagr_val),
        }
        return AssetDetailsWithPosition(**asset_serialized_with_position)
    
    async def get_portfolio_analysis(self, portfolio_id: int) -> dict:
        portfolio_position_df = await self.repo.get_portfolio_position_df(portfolio_id)

        if portfolio_position_df.empty:
            return None

        returns = calculate_portfolio_daily_returns(portfolio_position_df)
        returns['weighted_return'] = (returns['value'] / returns['net_value_day']) * returns['asset_return']
        grouped = returns.groupby('date')['weighted_return'].sum().reset_index()
        
        portfolio_returns = grouped.set_index('date')['weighted_return']
        start_date = grouped['date'].min()
            
        benchmarks = {}
        cdi_history = await self.market_data_service.get_index_history(start_date, INDEX.CDI)
        benchmarks['CDI'] = cdi_history
    
        result = calculate_returns_analysis(portfolio_returns, benchmarks)
        return result
    
    async def get_asset_analysis(self, portfolio_id: int, asset_id: int, currency: str = 'BRL') -> dict:
        asset_position_df = await self.repo.get_asset_position_df(
            portfolio_id, [asset_id], start_date=None, end_date=None
        )

        if asset_position_df.empty:
            return None

        return_col = 'asset_return_usd' if currency == 'USD' else 'asset_return'
        returns = calculate_portfolio_daily_returns(asset_position_df)
        returns = returns[['date', return_col]].rename(columns={return_col: 'asset_return'})
        
        asset_returns = returns.set_index('date')['asset_return']
        start_date = returns['date'].min()
            
        benchmarks = {}

        cdi_history = await self.market_data_service.get_index_history(start_date, INDEX.CDI)
        benchmarks['CDI'] = cdi_history

        category = await self.repo.get_asset_category(portfolio_id, asset_id)
        if category.benchmark_id != INDEX.CDI:
            benchmark_history = await self.market_data_service.get_index_history(
                start_date, category.benchmark_id
            )
            benchmarks[category.benchmark.short_name] = benchmark_history
        

        result = calculate_returns_analysis(asset_returns, benchmarks)

        return result


    async def get_aported_history(self, portfolio_id: int, currency: str = 'BRL'):
        transactions_df = await self.repo.get_transactions_df(portfolio_id)
        usd_brl_df = await self.market_data_service.get_usd_brl_history(transactions_df['date'].min())
        transactions_df = transactions_df.merge(usd_brl_df[['date', 'usdbrl']], on='date', how='left')
        if currency == 'USD':
            transactions_df['amount'] = transactions_df.apply(
                lambda row: row['quantity'] * row['price'] / (row['usdbrl'] if row['currency_id'] == CURRENCY.BRL else 1), axis=1
            )
        else:
            transactions_df['amount'] = transactions_df.apply(
                lambda row: row['quantity'] * row['price'] * (row['usdbrl'] if row['currency_id'] == CURRENCY.USD else 1), axis=1
            )
        total_aported = transactions_df.groupby('date')['amount'].sum().reset_index()
        total_aported.rename(columns={'amount': 'aported'}, inplace=True)
        return total_aported

    @cached(key_prefix="patrimony_evolution", cache=lambda self: self.cache, ttl=3600)
    async def get_patrimony_evolution(
        self, 
        portfolio_id: int,
        asset_id: int = None, 
        asset_type_id: int = None,
        asset_type_ids: list = None,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        return await self.compute_patrimony_evolution(
            portfolio_id, asset_id, asset_type_id, asset_type_ids, currency=currency,
        )
        
    async def compute_patrimony_evolution(
        self, portfolio_id: int,
        asset_id: int = None, 
        asset_type_id: int = None,
        asset_type_ids: list = None,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        portfolio_position_df = await self.repo.get_portfolio_position_df(
            portfolio_id, 
            asset_id=asset_id, 
            asset_type_id=asset_type_id, 
            asset_type_ids=asset_type_ids,
        )

        if portfolio_position_df.empty:
            return None

        df = portfolio_position_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        price_col = 'price_usd' if currency == 'USD' else 'price'
        df['patrimony'] = df['quantity'] * df[price_col]

        total_df = df.groupby('date')['patrimony'].sum().reset_index()
        total_df.rename(columns={'patrimony': 'portfolio'}, inplace=True)

        category_df = df.groupby(['date', 'category'])['patrimony'].sum().reset_index()
        category_pivot = category_df.pivot(
            index='date', columns='category', values='patrimony'
        ).reset_index()

        result = total_df.merge(category_pivot, on='date', how='left')
        
        aported_history = await self.get_aported_history(portfolio_id, currency=currency)
        result = result.merge(aported_history[['date', 'aported']], on='date', how='left')
        result['acc_aported'] = (
            result['aported']
            .fillna(0)
            .cumsum()
        )
        
        return df_to_dict_list(result)

    async def get_portfolio_returns(self, portfolio_id: int, currency: str = 'BRL'):
        return await self.repo.get_portfolio_returns(portfolio_id, currency) or None

    async def get_category_returns(self, portfolio_id: int, custom_category_id: int = None, most_recent: bool = False, currency: str = 'BRL'):
        return await self.repo.get_category_returns(portfolio_id, custom_category_id, most_recent, currency) or None

    async def get_asset_acc_returns(
        self,
        portfolio_id: int,
        asset_ids: list[int],
        start_date: str = None,
        end_date: str = None,
        currency: str = 'BRL',
    ):
        daily_returns_df = await self.get_asset_returns(portfolio_id, asset_ids, start_date, end_date, currency=currency)
        if daily_returns_df is None:
            return None
        returns_df = calculate_asset_acc_returns(daily_returns_df)
        return returns_df
    
    async def get_asset_returns(
        self,
        portfolio_id: int,
        asset_ids: list[int],
        start_date: str = None,
        end_date: str = None,
        currency: str = 'BRL',
    ):
        asset_position_df = await self.repo.get_asset_position_df(
            portfolio_id, asset_ids, start_date, end_date
        )

        if asset_position_df.empty:
            return None

        return_col = 'asset_return_usd' if currency == 'USD' else 'asset_return'
        daily_returns_df = calculate_portfolio_daily_returns(asset_position_df)
        result = daily_returns_df[['date', 'ticker', 'quantity', return_col]].copy()
        if currency == 'USD':
            result = result.rename(columns={return_col: 'asset_return'})
        return result
    

    async def get_portfolio_position(
        self, 
        portfolio_id: int,
        date: pd.Timestamp = None,
        asset_type_id = None,
        group_by_broker: bool = False,
        currency: str = 'BRL',
        ) -> list:
        if group_by_broker:
            pos_df = await self.repo.get_position_on_date_by_broker(
                portfolio_id, date, asset_type_id
            )
        else:
            pos_df = await self.repo.get_position_on_date(
                portfolio_id, date, asset_type_id, currency=currency
            )
        
        if pos_df is None or pos_df.empty:
            return []

        pos_df['value'] = pos_df['quantity'] * pos_df['price']

        return df_response(pos_df)

    async def get_portfolio_position_history(
        self, portfolio_id: int, asset_id: int = None, currency: str = 'BRL'
    ) -> pd.DataFrame:
        pos_df = await self.repo.get_portfolio_position_df(portfolio_id, asset_id=asset_id)

        if pos_df.empty:
            return []

        price_col = 'price_usd' if currency == 'USD' else 'price'
        avg_price_col = 'average_price_usd' if currency == 'USD' else 'average_price'
        pos_df['price'] = pos_df[price_col]
        pos_df['average_price'] = pos_df[avg_price_col]
        pos_df['value'] = pos_df['quantity'] * pos_df['price']

        return df_response(pos_df)

    async def get_consolidated_portfolio_returns(self, portfolio_id: int):
        """Used by the cache task to pre-compute and store in Redis."""
        return await self.repo.get_portfolio_returns(portfolio_id) or None

    async def get_portfolio_stats(self, portfolio_id: int, currency: str = 'BRL') -> dict:
        rows = await self.repo.get_portfolio_returns(portfolio_id, currency)
        if not rows:
            return None

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        returns_series = df.set_index('date')['daily_return']
        start_date = df['date'].min()

        benchmarks = {}
        cdi_history = await self.market_data_service.get_index_history(start_date, INDEX.CDI)
        benchmarks['CDI'] = cdi_history

        result = calculate_returns_analysis(returns_series, benchmarks)
        return result

    async def get_category_stats(self, portfolio_id: int, custom_category_id: int, currency: str = 'BRL') -> dict:
        rows = await self.repo.get_category_returns(portfolio_id, custom_category_id, currency=currency)
        if not rows:
            return None

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        returns_series = df.set_index('date')['daily_return']
        start_date = df['date'].min()

        benchmarks = {}
        cdi_history = await self.market_data_service.get_index_history(start_date, INDEX.CDI)
        benchmarks['CDI'] = cdi_history

        category = await self.repo.get_asset_category_by_id(custom_category_id)
        if category and category.benchmark_id and category.benchmark_id != INDEX.CDI:
            benchmark_history = await self.market_data_service.get_index_history(
                start_date, category.benchmark_id
            )
            benchmarks[category.benchmark.short_name] = benchmark_history

        result = calculate_returns_analysis(returns_series, benchmarks)
        return result