# app/modules/portfolio/service/portfolio_position_service.py
"""
Portfolio position service - handles position queries and analysis.
"""

import pandas as pd

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.lib.finance.performance_metrics import cagr
from app.lib.utils.df import df_to_dict_list, rows_to_df
from app.lib.utils.fastapi import df_response
from app.modules.market_data.domain.constants import SERIES
from app.modules.market_data.service.market_data_service import MarketDataReadService
from app.modules.portfolio.domain.asset_analysis import calculate_returns_analysis
from app.modules.portfolio.domain.asset_position import AssetPosition
from app.modules.portfolio.domain.entities import Position
from app.modules.portfolio.domain.returns import (
    calculate_asset_acc_returns,
    calculate_portfolio_daily_returns,
)

PATRIMONY_EVOLUTION_CACHE_PREFIX = 'patrimony_evolution'
ASSET_TYPE_RETURNS_CACHE_PREFIX = 'asset_type_returns'


class PortfolioPositionService:
    def __init__(
        self,
        uow: UnitOfWork,
        market_data_service: MarketDataReadService,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.market_data_service = market_data_service
        self.cache = cache or RedisService()

    async def invalidate_cached_analytics(self, portfolio_id: int) -> None:
        """Drop the derived reads a portfolio's positions feed.

        Called by the write paths that recalculate positions. Nothing repopulates
        the cache here: the next read misses and fills it with fresh data. The
        trailing separator keeps portfolio 1 from matching portfolio 10.
        """
        await self.cache.delete_prefix(f'{PATRIMONY_EVOLUTION_CACHE_PREFIX}:{portfolio_id}:')
        await self.cache.delete_prefix(f'{ASSET_TYPE_RETURNS_CACHE_PREFIX}:{portfolio_id}:')

    async def get_asset_details(
        self, portfolio_id: int, asset_id: int | None = None, currency: str = 'BRL'
    ) -> AssetPosition:
        async with self.uow as uow:
            asset = await uow.portfolios.get_asset_details(asset_id)
            if not asset:
                raise NotFoundError('Ativo não encontrado')

            position = await uow.portfolios.get(
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

        return AssetPosition(
            asset=asset,
            quantity=position.quantity,
            price=price,
            average_price=average_price,
            value=(position.quantity * price),
            acc_return=(None if pd.isna(acc_return_val) else acc_return_val),
            twelve_months_return=(None if pd.isna(twelve_months_val) else twelve_months_val),
            cagr=(None if pd.isna(cagr_val) else cagr_val),
        )

    async def get_portfolio_analysis(
        self,
        portfolio_id: int,
        currency: str = 'BRL',
    ) -> dict:
        async with self.uow as uow:
            position_rows = await uow.portfolios.get_portfolio_position(portfolio_id)
        portfolio_position_df = rows_to_df(
            position_rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )

        if portfolio_position_df.empty:
            return None

        returns = calculate_portfolio_daily_returns(portfolio_position_df)
        returns['weighted_return'] = (returns['value'] / returns['net_value_day']) * returns[
            'asset_return'
        ]
        grouped = returns.groupby('date')['weighted_return'].sum().reset_index()

        portfolio_returns = grouped.set_index('date')['weighted_return']
        start_date = grouped['date'].min()

        benchmarks = {}
        cdi_history = await self.market_data_service.get_series_history_values(
            start_date, SERIES.CDI, currency
        )
        benchmarks['CDI'] = cdi_history

        result = calculate_returns_analysis(portfolio_returns, benchmarks)
        return result

    async def get_asset_analysis(
        self, portfolio_id: int, asset_id: int, currency: str = 'BRL'
    ) -> dict:
        async with self.uow as uow:
            asset_position_rows = await uow.portfolios.get_asset_position(
                portfolio_id, [asset_id], start_date=None, end_date=None
            )
        asset_position_df = rows_to_df(
            asset_position_rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )

        if asset_position_df.empty:
            return None

        return_col = 'asset_return_usd' if currency == 'USD' else 'asset_return'
        returns = calculate_portfolio_daily_returns(asset_position_df)
        returns = returns[['date', return_col]].rename(columns={return_col: 'asset_return'})

        asset_returns = returns.set_index('date')['asset_return']
        start_date = returns['date'].min()

        benchmarks = {}

        cdi_history = await self.market_data_service.get_series_history_values(
            start_date, SERIES.CDI, currency
        )
        benchmarks['CDI'] = cdi_history

        async with self.uow as uow:
            category = await uow.portfolios.get_asset_category(portfolio_id, asset_id)
            benchmark_id = category.benchmark_id
            benchmark_name = category.benchmark.short_name if benchmark_id != SERIES.CDI else None

        if benchmark_id != SERIES.CDI:
            benchmarks[benchmark_name] = await self.market_data_service.get_series_history_values(
                start_date, benchmark_id, currency
            )

        result = calculate_returns_analysis(asset_returns, benchmarks)

        return result

    async def get_aported_history(self, portfolio_id: int, currency: str = 'BRL'):
        async with self.uow as uow:
            rows = await uow.portfolios.get_transactions(portfolio_id)
        if not rows:
            return pd.DataFrame(columns=['date', 'aported'])
        transactions_df = pd.DataFrame(rows)
        transactions_df['date'] = pd.to_datetime(transactions_df['date'])
        price_col = 'price_usd' if currency == 'USD' else 'price'
        transactions_df['amount'] = transactions_df['quantity'] * transactions_df[price_col].fillna(
            0
        )
        total_aported = transactions_df.groupby('date')['amount'].sum().reset_index()
        total_aported.rename(columns={'amount': 'aported'}, inplace=True)
        return total_aported

    @cached(key_prefix='patrimony_evolution', cache=lambda self: self.cache, ttl=3600)
    async def get_patrimony_evolution(
        self,
        portfolio_id: int,
        asset_id: int | None = None,
        asset_type_id: int | None = None,
        asset_type_ids: list | None = None,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        return await self.compute_patrimony_evolution(
            portfolio_id,
            asset_id,
            asset_type_id,
            asset_type_ids,
            currency=currency,
        )

    async def compute_patrimony_evolution(
        self,
        portfolio_id: int,
        asset_id: int | None = None,
        asset_type_id: int | None = None,
        asset_type_ids: list | None = None,
        currency: str = 'BRL',
    ) -> pd.DataFrame:
        async with self.uow as uow:
            position_rows = await uow.portfolios.get_portfolio_position(
                portfolio_id,
                asset_id=asset_id,
                asset_type_id=asset_type_id,
                asset_type_ids=asset_type_ids,
            )
        portfolio_position_df = rows_to_df(
            position_rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
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
        result['acc_aported'] = result['aported'].fillna(0).cumsum()

        return df_to_dict_list(result)

    async def get_portfolio_returns(self, portfolio_id: int, currency: str = 'BRL'):
        async with self.uow as uow:
            return await uow.portfolios.get_portfolio_returns(portfolio_id, currency) or None

    @cached(key_prefix=ASSET_TYPE_RETURNS_CACHE_PREFIX, cache=lambda self: self.cache, ttl=3600)
    async def get_asset_type_returns(
        self,
        portfolio_id: int,
        asset_type_id: int,
        currency: str = 'BRL',
    ) -> list[dict]:
        """Read the consolidated series, with an on-the-fly compatibility fallback.

        The fallback keeps the page useful for portfolios that have not run the
        new asset-type consolidator yet. The normal write path persists the same
        series in ``portfolio.asset_type_return``.
        """
        async with self.uow as uow:
            stored = await uow.portfolios.get_asset_type_returns(
                portfolio_id, asset_type_id, currency
            )
        if stored:
            stored_df = rows_to_df(stored, datetime_cols=['date'])
            stored_df['date'] = stored_df['date'].dt.strftime('%Y-%m-%d')
            return df_to_dict_list(stored_df)

        return await self._calculate_asset_type_returns(portfolio_id, asset_type_id, currency)

    async def _calculate_asset_type_returns(
        self,
        portfolio_id: int,
        asset_type_id: int,
        currency: str = 'BRL',
    ) -> list[dict]:
        async with self.uow as uow:
            rows = await uow.portfolios.get_portfolio_position(
                portfolio_id,
                asset_type_id=asset_type_id,
            )

        position_df = rows_to_df(
            rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )
        if position_df.empty:
            return []

        returns = calculate_portfolio_daily_returns(position_df)
        suffix = '_usd' if currency == 'USD' else ''
        value_col = f'value{suffix}'
        asset_return_col = f'asset_return{suffix}'

        returns['base_value'] = (returns[value_col] - returns[f'contribution{suffix}']).replace(
            0, pd.NA
        )
        returns['base_value_prev'] = returns.groupby('asset_id')['base_value'].shift(1)
        returns['type_base_prev_total'] = returns.groupby('date')['base_value_prev'].transform(
            'sum'
        )
        returns['type_weight'] = returns['base_value_prev'] / returns[
            'type_base_prev_total'
        ].replace(0, pd.NA)
        returns['weighted_return'] = returns['type_weight'] * returns[asset_return_col]
        returns['weighted_return'] = pd.to_numeric(
            returns['weighted_return'], errors='coerce'
        ).fillna(0)

        grouped = returns.groupby('date')['weighted_return'].sum().reset_index()
        grouped.rename(columns={'weighted_return': 'daily_return'}, inplace=True)
        grouped['acc_return'] = (1 + grouped['daily_return']).cumprod() - 1
        grouped['cagr'] = None

        daily = grouped.set_index('date')['daily_return']
        for index in range(1, len(grouped)):
            grouped.loc[grouped.index[index], 'cagr'] = cagr(daily.iloc[: index + 1])

        grouped['date'] = grouped['date'].dt.strftime('%Y-%m-%d')
        return df_to_dict_list(grouped[['date', 'daily_return', 'acc_return', 'cagr']])

    async def get_asset_type_stats(
        self,
        portfolio_id: int,
        asset_type_id: int,
        currency: str = 'BRL',
    ) -> dict | None:
        rows = await self.get_asset_type_returns(portfolio_id, asset_type_id, currency)
        if not rows:
            return None

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        returns_series = df.set_index('date')['daily_return']
        start_date = df['date'].min()
        cdi_history = await self.market_data_service.get_series_history_values(
            start_date, SERIES.CDI, currency
        )
        return calculate_returns_analysis(returns_series, {'CDI': cdi_history})

    async def get_category_returns(
        self,
        portfolio_id: int,
        custom_category_id: int | None = None,
        most_recent: bool = False,
        currency: str = 'BRL',
    ):
        async with self.uow as uow:
            rows = await uow.portfolios.get_category_returns(
                portfolio_id, custom_category_id, most_recent, currency
            )
        return rows or None

    async def get_asset_acc_returns(
        self,
        portfolio_id: int,
        asset_ids: list[int],
        start_date: str | None = None,
        end_date: str | None = None,
        currency: str = 'BRL',
    ):
        daily_returns_df = await self.get_asset_returns(
            portfolio_id, asset_ids, start_date, end_date, currency=currency
        )
        if daily_returns_df is None:
            return None
        returns_df = calculate_asset_acc_returns(daily_returns_df)
        return returns_df

    async def get_asset_returns(
        self,
        portfolio_id: int,
        asset_ids: list[int],
        start_date: str | None = None,
        end_date: str | None = None,
        currency: str = 'BRL',
    ):
        async with self.uow as uow:
            asset_position_rows = await uow.portfolios.get_asset_position(
                portfolio_id, asset_ids, start_date, end_date
            )
        asset_position_df = rows_to_df(
            asset_position_rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
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
        asset_type_id=None,
        group_by_broker: bool = False,
        currency: str = 'BRL',
    ) -> list:
        async with self.uow as uow:
            if group_by_broker:
                rows = await uow.portfolios.get_position_on_date_by_broker(
                    portfolio_id, date, asset_type_id
                )
            else:
                rows = await uow.portfolios.get_position_on_date(
                    portfolio_id, date, asset_type_id, currency=currency
                )

        pos_df = rows_to_df(
            rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend'],
        )

        if pos_df.empty:
            return []

        pos_df['value'] = pos_df['quantity'] * pos_df['price']

        return df_response(pos_df)

    async def get_portfolio_position_history(
        self, portfolio_id: int, asset_id: int | None = None, currency: str = 'BRL'
    ) -> pd.DataFrame:
        async with self.uow as uow:
            position_rows = await uow.portfolios.get_portfolio_position(
                portfolio_id, asset_id=asset_id
            )
        pos_df = rows_to_df(
            position_rows,
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )

        if pos_df.empty:
            return []

        price_col = 'price_usd' if currency == 'USD' else 'price'
        avg_price_col = 'average_price_usd' if currency == 'USD' else 'average_price'
        pos_df['price'] = pos_df[price_col]
        pos_df['average_price'] = pos_df[avg_price_col]
        pos_df['value'] = pos_df['quantity'] * pos_df['price']

        return df_response(pos_df)

    async def get_portfolio_stats(self, portfolio_id: int, currency: str = 'BRL') -> dict:
        async with self.uow as uow:
            rows = await uow.portfolios.get_portfolio_returns(portfolio_id, currency)
        if not rows:
            return None

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        returns_series = df.set_index('date')['daily_return']
        start_date = df['date'].min()

        benchmarks = {}
        cdi_history = await self.market_data_service.get_series_history_values(
            start_date, SERIES.CDI, currency
        )
        benchmarks['CDI'] = cdi_history

        result = calculate_returns_analysis(returns_series, benchmarks)
        return result

    async def get_category_stats(
        self, portfolio_id: int, custom_category_id: int, currency: str = 'BRL'
    ) -> dict:
        async with self.uow as uow:
            rows = await uow.portfolios.get_category_returns(
                portfolio_id, custom_category_id, currency=currency
            )
        if not rows:
            return None

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        returns_series = df.set_index('date')['daily_return']
        start_date = df['date'].min()

        benchmarks = {}
        cdi_history = await self.market_data_service.get_series_history_values(
            start_date, SERIES.CDI, currency
        )
        benchmarks['CDI'] = cdi_history

        async with self.uow as uow:
            category = await uow.portfolios.get_asset_category_by_id(custom_category_id)
            benchmark_id = category.benchmark_id if category else None
            benchmark_name = (
                category.benchmark.short_name
                if benchmark_id and benchmark_id != SERIES.CDI
                else None
            )

        if benchmark_name is not None:
            benchmarks[benchmark_name] = await self.market_data_service.get_series_history_values(
                start_date, benchmark_id, currency
            )

        return calculate_returns_analysis(returns_series, benchmarks)
