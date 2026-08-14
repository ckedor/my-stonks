# app/modules/portfolio/service/portfolio_returns_consolidator_service.py
"""
Service to consolidate portfolio and category returns into the database.
"""

import pandas as pd

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.finance.performance_metrics import cagr
from app.lib.utils.df import rows_to_df
from app.modules.portfolio.domain.entities import (
    CategoryReturn,
    CustomCategory,
    PortfolioReturn,
)
from app.modules.portfolio.domain.returns import calculate_portfolio_daily_returns
from app.modules.portfolio.repositories import PortfolioRepository


class PortfolioReturnsConsolidatorService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def consolidate_returns(self, portfolio_id: int):
        logger.info(f'Consolidando retornos do portfolio {portfolio_id}')

        async with self.uow as uow:
            portfolio_position_df = rows_to_df(
                await uow.portfolios.get_portfolio_position(portfolio_id),
                datetime_cols=['date'],
                numeric_fillna_cols=['dividend', 'dividend_usd'],
            )
            if portfolio_position_df.empty:
                logger.warning(f'Sem posições para portfolio {portfolio_id}')
                return

            pos_df = calculate_portfolio_daily_returns(portfolio_position_df)
            await self._consolidate_portfolio_returns(
                uow.portfolios,
                pos_df,
                portfolio_id,
            )
            await self._consolidate_category_returns(
                uow.portfolios,
                pos_df,
                portfolio_id,
            )
            await uow.commit()
        logger.info(f'Retornos consolidados com sucesso para portfolio {portfolio_id}')

    async def consolidate_category_returns(self, portfolio_id: int):
        logger.info(f'Consolidando retornos das categorias do portfolio {portfolio_id}')

        async with self.uow as uow:
            portfolio_position_df = rows_to_df(
                await uow.portfolios.get_portfolio_position(portfolio_id),
                datetime_cols=['date'],
                numeric_fillna_cols=['dividend', 'dividend_usd'],
            )
            if portfolio_position_df.empty:
                logger.warning(f'Sem posições para portfolio {portfolio_id}')
                return

            pos_df = calculate_portfolio_daily_returns(portfolio_position_df)
            await self._consolidate_category_returns(
                uow.portfolios,
                pos_df,
                portfolio_id,
            )
            await uow.commit()
        logger.info(f'Retornos das categorias consolidados para portfolio {portfolio_id}')

    async def _consolidate_portfolio_returns(
        self,
        repository: PortfolioRepository,
        pos_df: pd.DataFrame,
        portfolio_id: int,
    ):
        df = pos_df.copy()

        # BRL
        df['weighted_return'] = (df['value'] / df['net_value_day']) * df['asset_return']
        grouped = df.groupby('date')['weighted_return'].sum().reset_index()
        grouped.rename(columns={'weighted_return': 'daily_return'}, inplace=True)
        grouped['acc_return'] = (1 + grouped['daily_return']).cumprod() - 1

        # USD
        df['weighted_return_usd'] = (df['value_usd'] / df['net_value_day_usd']) * df[
            'asset_return_usd'
        ]
        grouped_usd = df.groupby('date')['weighted_return_usd'].sum().reset_index()
        grouped_usd.rename(columns={'weighted_return_usd': 'daily_return_usd'}, inplace=True)
        grouped_usd['acc_return_usd'] = (1 + grouped_usd['daily_return_usd']).cumprod() - 1

        grouped = grouped.merge(grouped_usd, on='date', how='left')

        # Calculate CAGR for each date (BRL)
        grouped['cagr'] = None
        returns_series = grouped.set_index('date')['daily_return']
        for i in range(1, len(grouped)):
            partial = returns_series.iloc[: i + 1]
            if len(partial) >= 2:
                grouped.loc[grouped.index[i], 'cagr'] = cagr(partial)

        # Calculate CAGR for each date (USD)
        grouped['cagr_usd'] = None
        returns_series_usd = grouped.set_index('date')['daily_return_usd']
        for i in range(1, len(grouped)):
            partial = returns_series_usd.iloc[: i + 1]
            if len(partial) >= 2:
                grouped.loc[grouped.index[i], 'cagr_usd'] = cagr(partial)

        grouped['portfolio_id'] = portfolio_id
        grouped['date'] = grouped['date'].dt.date

        records = grouped[PortfolioReturn.COLUMNS].to_dict(orient='records')
        await repository.upsert_bulk(
            PortfolioReturn, records, unique_columns=['portfolio_id', 'date']
        )

    async def _consolidate_category_returns(
        self,
        repository: PortfolioRepository,
        pos_df: pd.DataFrame,
        portfolio_id: int,
    ):
        # Build category name -> id mapping
        categories = await repository.get(CustomCategory, by={'portfolio_id': portfolio_id})
        if not categories:
            return

        cat_name_to_id = {cat.name: cat.id for cat in categories}

        df = pos_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(['asset_id', 'date'])

        # BRL weights
        df['base_value'] = (df['value'] - df['contribution']).replace(0, pd.NA)
        df['base_value_prev'] = df.groupby('asset_id')['base_value'].shift(1)
        df['category_base_prev_total'] = df.groupby(['date', 'category'])[
            'base_value_prev'
        ].transform('sum')

        df['category_weight'] = df['base_value_prev'] / df['category_base_prev_total'].replace(
            0, pd.NA
        )
        df['category_weight'] = pd.to_numeric(df['category_weight'], errors='coerce').fillna(0)
        df['category_weighted_return'] = df['category_weight'] * df['asset_return']

        # USD weights
        df['base_value_usd'] = (df['value_usd'] - df['contribution_usd']).replace(0, pd.NA)
        df['base_value_prev_usd'] = df.groupby('asset_id')['base_value_usd'].shift(1)
        df['category_base_prev_total_usd'] = df.groupby(['date', 'category'])[
            'base_value_prev_usd'
        ].transform('sum')

        df['category_weight_usd'] = df['base_value_prev_usd'] / df[
            'category_base_prev_total_usd'
        ].replace(0, pd.NA)
        df['category_weight_usd'] = pd.to_numeric(
            df['category_weight_usd'], errors='coerce'
        ).fillna(0)
        df['category_weighted_return_usd'] = df['category_weight_usd'] * df['asset_return_usd']

        daily = (
            df.groupby(['date', 'category'])
            .agg(
                daily_return=('category_weighted_return', 'sum'),
                daily_return_usd=('category_weighted_return_usd', 'sum'),
            )
            .reset_index()
        )

        all_records = []
        for cat_name, cat_df in daily.groupby('category'):
            cat_id = cat_name_to_id.get(cat_name)
            if cat_id is None:
                continue

            sorted_df = cat_df.sort_values('date').reset_index(drop=True)
            sorted_df['acc_return'] = (1 + sorted_df['daily_return']).cumprod() - 1
            sorted_df['acc_return_usd'] = (1 + sorted_df['daily_return_usd']).cumprod() - 1

            # Calculate CAGR for each date (BRL)
            sorted_df['cagr'] = None
            returns_series = sorted_df.set_index('date')['daily_return']
            for i in range(1, len(sorted_df)):
                partial = returns_series.iloc[: i + 1]
                if len(partial) >= 2:
                    sorted_df.loc[sorted_df.index[i], 'cagr'] = cagr(partial)

            # Calculate CAGR for each date (USD)
            sorted_df['cagr_usd'] = None
            returns_series_usd = sorted_df.set_index('date')['daily_return_usd']
            for i in range(1, len(sorted_df)):
                partial = returns_series_usd.iloc[: i + 1]
                if len(partial) >= 2:
                    sorted_df.loc[sorted_df.index[i], 'cagr_usd'] = cagr(partial)

            sorted_df['portfolio_id'] = portfolio_id
            sorted_df['custom_category_id'] = cat_id
            sorted_df['date'] = sorted_df['date'].dt.date

            all_records.extend(cat_df[CategoryReturn.COLUMNS].to_dict(orient='records'))

        if all_records:
            await repository.upsert_bulk(
                CategoryReturn,
                all_records,
                unique_columns=['portfolio_id', 'custom_category_id', 'date'],
            )
