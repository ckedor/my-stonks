# app/modules/portfolio/service/portfolio_returns_consolidator_service.py
"""Consolidate a portfolio's return series, at every altitude it is read at.

The portfolio as a whole, each custom category, each asset type and each
portfolio segment are the same arithmetic over different groupings: a position
weighs by what it was worth the day before, the weighted returns are summed per
day, and the daily series is compounded and annualized. So there is one
computation here and one table behind it, discriminated by scope.
"""

from datetime import UTC, datetime

import pandas as pd

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.lib.finance.performance_metrics import cagr
from app.lib.utils.df import rows_to_df
from app.modules.portfolio.domain.entities import (
    CustomCategory,
    PortfolioConsolidation,
    ReturnSeries,
)
from app.modules.portfolio.domain.portfolio_segment import resolve_segment
from app.modules.portfolio.domain.return_scope import WHOLE_PORTFOLIO_KEY, ReturnScope
from app.modules.portfolio.domain.returns import calculate_portfolio_daily_returns
from app.modules.portfolio.repositories import PortfolioRepository

CONSOLIDATION_SUCCESS = 'success'
CONSOLIDATION_PARTIAL = 'partial'
CONSOLIDATION_FAILURE = 'failure'


class PortfolioReturnsConsolidatorService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def consolidate_returns(self, portfolio_id: int) -> None:
        """Rebuild every return series of a portfolio, in one transaction."""
        logger.info(f'Consolidando retornos do portfolio {portfolio_id}')

        async with self.uow as uow:
            position_df = await self._position_returns(uow.portfolios, portfolio_id)
            if position_df is None:
                await uow.portfolios.delete_return_series(portfolio_id)
                await uow.commit()
                return

            records = (
                self._portfolio_records(position_df, portfolio_id)
                + await self._category_records(uow.portfolios, position_df, portfolio_id)
                + self._asset_type_records(position_df, portfolio_id)
                + self._segment_records(position_df, portfolio_id)
            )
            # This is a rebuild, not an incremental merge. Without deleting
            # first, dates that disappeared from the position history survive
            # the upsert and keep the old head or tail of every derived curve.
            await uow.portfolios.delete_return_series(portfolio_id)
            if records:
                await uow.portfolios.upsert_bulk(
                    ReturnSeries,
                    records,
                    unique_columns=ReturnSeries.UNIQUE_COLUMNS,
                )
            await uow.commit()

        logger.info(f'Retornos consolidados com sucesso para portfolio {portfolio_id}')

    async def mark_consolidated(
        self,
        portfolio_id: int,
        *,
        status: str = CONSOLIDATION_SUCCESS,
        error: str | None = None,
    ) -> None:
        """Stamp when this portfolio's derived data was last rebuilt.

        One row per portfolio, overwritten each run. It lives here because every
        path that consolidates a portfolio ends in this service: the return
        series are the last thing rebuilt, so the moment they land is the moment
        the whole derived layer is current.
        """
        async with self.uow as uow:
            await uow.portfolios.upsert_bulk(
                PortfolioConsolidation,
                [
                    {
                        'portfolio_id': portfolio_id,
                        'consolidated_at': datetime.now(UTC),
                        'status': status,
                        'error': error,
                    }
                ],
                unique_columns=['portfolio_id'],
            )
            await uow.commit()

    async def _position_returns(
        self,
        repository: PortfolioRepository,
        portfolio_id: int,
    ) -> pd.DataFrame | None:
        position_df = rows_to_df(
            await repository.get_portfolio_position(portfolio_id),
            datetime_cols=['date'],
            numeric_fillna_cols=['dividend', 'dividend_usd'],
        )
        if position_df.empty:
            logger.warning(f'Sem posições para portfolio {portfolio_id}')
            return None

        returns = calculate_portfolio_daily_returns(position_df)
        returns['date'] = pd.to_datetime(returns['date'])
        return returns.sort_values(['asset_id', 'date'])

    def _portfolio_records(self, position_df: pd.DataFrame, portfolio_id: int) -> list[dict]:
        """The portfolio-wide series, weighted by each day's net value.

        Its weight is the position's share of the whole day rather than of a
        group, which is why it does not go through `_records_grouped_by`.
        """
        df = position_df.copy()
        df['weighted_return'] = (df['value'] / df['net_value_day']) * df['asset_return']
        df['weighted_return_usd'] = (df['value_usd'] / df['net_value_day_usd']) * df[
            'asset_return_usd'
        ]
        daily = (
            df.groupby('date')
            .agg(
                daily_return=('weighted_return', 'sum'),
                daily_return_usd=('weighted_return_usd', 'sum'),
            )
            .reset_index()
        )
        return self._series_records(
            daily,
            portfolio_id=portfolio_id,
            scope=ReturnScope.PORTFOLIO,
            scope_key=WHOLE_PORTFOLIO_KEY,
        )

    async def _category_records(
        self,
        repository: PortfolioRepository,
        position_df: pd.DataFrame,
        portfolio_id: int,
    ) -> list[dict]:
        categories = await repository.get(CustomCategory, by={'portfolio_id': portfolio_id})
        if not categories:
            return []

        ids_by_name = {category.name: category.id for category in categories}
        return self._records_grouped_by(
            position_df,
            portfolio_id=portfolio_id,
            scope=ReturnScope.CATEGORY,
            group_column='category',
            # A posição carrega o nome da categoria, e o id é o que a série
            # guarda: uma categoria renomeada continua sendo a mesma série.
            key_of=lambda name: (str(ids_by_name[name]) if name in ids_by_name else None),
        )

    def _asset_type_records(self, position_df: pd.DataFrame, portfolio_id: int) -> list[dict]:
        return self._records_grouped_by(
            position_df,
            portfolio_id=portfolio_id,
            scope=ReturnScope.ASSET_TYPE,
            group_column='asset_type_id',
            key_of=lambda asset_type_id: str(int(asset_type_id)),
        )

    def _segment_records(self, position_df: pd.DataFrame, portfolio_id: int) -> list[dict]:
        """The specialized screens' series, persisted like any other scope.

        Two of the five segments are exactly one asset type and would duplicate
        that series; they are written anyway, so that reading a segment is one
        query with one shape instead of a branch on which kind of segment it is.
        A position outside every segment resolves to None and is left out.
        """
        df = position_df.copy()
        # O ticker entra ao lado da bolsa porque ela sozinha não separa os dois
        # lados: quase todo o cadastro entrou sem bolsa, e sem o ticker os ETFs
        # americanos caíam no segmento brasileiro.
        empty = pd.Series([None] * len(df))
        df['segment'] = [
            resolve_segment(asset_type_id, exchange, ticker)
            for asset_type_id, exchange, ticker in zip(
                df['asset_type_id'],
                df.get('exchange', empty),
                df.get('ticker', empty),
                strict=False,
            )
        ]
        return self._records_grouped_by(
            df,
            portfolio_id=portfolio_id,
            scope=ReturnScope.SEGMENT,
            group_column='segment',
            key_of=lambda segment: segment,
        )

    def _records_grouped_by(
        self,
        position_df: pd.DataFrame,
        *,
        portfolio_id: int,
        scope: ReturnScope,
        group_column: str,
        key_of,
    ) -> list[dict]:
        """Value-weighted daily returns for each value of ``group_column``.

        Each asset weighs by what it was worth the day before, inside its own
        group, so a contribution made today does not read as a gain and the
        groups do not borrow weight from each other.
        """
        df = position_df.copy()
        df = df[df[group_column].notna()]
        if df.empty:
            return []

        for suffix in ('', '_usd'):
            base = (df[f'value{suffix}'] - df[f'contribution{suffix}']).replace(0, pd.NA)
            previous = base.groupby(df['asset_id']).shift(1)
            group_total = previous.groupby([df['date'], df[group_column]]).transform('sum')
            weight = previous / group_total.replace(0, pd.NA)
            df[f'weighted_return{suffix}'] = (
                pd.to_numeric(weight, errors='coerce').fillna(0) * df[f'asset_return{suffix}']
            )

        daily = (
            df.groupby(['date', group_column])
            .agg(
                daily_return=('weighted_return', 'sum'),
                daily_return_usd=('weighted_return_usd', 'sum'),
            )
            .reset_index()
        )

        records: list[dict] = []
        for group_value, group_df in daily.groupby(group_column):
            scope_key = key_of(group_value)
            if scope_key is None:
                continue
            records.extend(
                self._series_records(
                    group_df.drop(columns=[group_column]),
                    portfolio_id=portfolio_id,
                    scope=scope,
                    scope_key=scope_key,
                )
            )
        return records

    def _series_records(
        self,
        daily: pd.DataFrame,
        *,
        portfolio_id: int,
        scope: ReturnScope,
        scope_key: str,
    ) -> list[dict]:
        """Compound and annualize one daily series, then shape it for the table."""
        series = daily.sort_values('date').reset_index(drop=True)
        series['acc_return'] = (1 + series['daily_return']).cumprod() - 1
        series['acc_return_usd'] = (1 + series['daily_return_usd']).cumprod() - 1
        series['cagr'] = None
        series['cagr_usd'] = None

        brl = series.set_index('date')['daily_return']
        usd = series.set_index('date')['daily_return_usd']
        for index in range(1, len(series)):
            series.loc[series.index[index], 'cagr'] = cagr(brl.iloc[: index + 1])
            series.loc[series.index[index], 'cagr_usd'] = cagr(usd.iloc[: index + 1])

        series['portfolio_id'] = portfolio_id
        series['scope'] = str(scope)
        series['scope_key'] = scope_key
        series['date'] = series['date'].dt.date
        return series[ReturnSeries.COLUMNS].to_dict(orient='records')
