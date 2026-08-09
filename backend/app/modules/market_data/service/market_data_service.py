# app/modules/market_data/service/market_data_service.py
"""
Market data service - handles market indexes, USD/BRL history, and asset quotes.
"""

from datetime import date, datetime
import pandas as pd

from app.modules.market_data.domain.assets import Currency
from app.modules.market_data.domain.constants import INDEX
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.lib.finance.returns import calculate_acc_returns_from_prices
from app.lib.utils.df import df_to_named_dict, rows_to_df
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.market_data.domain.usd_brl import (
    usd_brl_history_to_df,
    usd_brl_history_to_payload,
)
from app.infra.db.unit_of_work import UnitOfWork


class MarketDataReadService:
    def __init__(
        self,
        uow: UnitOfWork,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.cache = cache or RedisService()

    async def list_indexes(self):
        async with self.uow as uow:
            return await uow.market_data.get(MarketDataSeries)

    async def list_market_data_series(self):
        async with self.uow as uow:
            return await uow.market_data.get(MarketDataSeries)

    async def list_currencies(self):
        async with self.uow as uow:
            return await uow.market_data.get(Currency, order_by='code')

    async def get_series_history(self, series_id: int, start_date: date | None = None):
        async with self.uow as uow:
            return await uow.market_data.get_series_history_entries(
                series_id,
                start_date=start_date,
            )

    USD_INDEXES = {INDEX.SP500, INDEX.NASDAQ}

    async def get_index_history(
        self, start_date: pd.Timestamp = None, index_id: int = None
    ) -> pd.Series:
        """
        Returns a price-like Series with DatetimeIndex for a given index.
        For rate-based indexes (CDI, IPCA), builds a cumulative index from daily rates.
        For USD-based indexes (S&P500, NASDAQ), converts to BRL.
        For price-based indexes (IBOV, etc.), returns the value directly.
        """
        async with self.uow as uow:
            rows = await uow.market_data.get_index_history(start_date, index_id=index_id)
        df = rows_to_df(rows, datetime_cols=['date'])
        df = df.sort_values('date')
        df['value'] = df['value'].astype(float)

        if index_id in {INDEX.IPCA, INDEX.CDI}:
            values = self._build_index_from_percent(df['value'])
        else:
            values = df['value']

        if index_id in self.USD_INDEXES:
            usd_brl_df = await self.get_usd_brl_history(start_date)
            df = df.merge(usd_brl_df[['date', 'usd_brl']], on='date', how='left')
            df['usd_brl'] = df['usd_brl'].ffill()
            values *= df['usd_brl'].values

        values.index = df['date'].values
        values.index.name = 'date'
        return values

    @cached(key_prefix='indexes_history', cache=lambda self: self.cache, ttl=3600)
    async def get_indexes_history(self, start_date: pd.Timestamp = None) -> pd.DataFrame:
        return await self.compute_indexes_history(start_date)

    async def compute_indexes_history(self, start_date: pd.Timestamp = None):
        start_date = start_date or pd.Timestamp(datetime.today()) - pd.DateOffset(years=5)
        async with self.uow as uow:
            index_history_rows = await uow.market_data.get_index_history(start_date)
        index_history_df = rows_to_df(index_history_rows, datetime_cols=['date'])

        index_history_returns_df = pd.DataFrame()

        # USD/BRL is not a market-data series: it always comes from its own
        # table, and is appended here only so it can be charted alongside them.
        usd_brl_df = await self.get_usd_brl_history(start_date)
        usd_series_df = usd_brl_df.rename(columns={'usd_brl': 'value'}).copy()
        usd_series_df['index_name'] = 'USD/BRL'
        index_history_df = pd.concat(
            [index_history_df, usd_series_df[['date', 'value', 'index_name']]],
            ignore_index=True,
        )

        for index_name in index_history_df['index_name'].unique():
            index_series = index_history_df[index_history_df['index_name'] == index_name].copy()
            index_series.index = index_series['date']
            index_series = index_series.drop(columns=['date'])
            index_series[index_name] = index_series['value'].astype(float)
            index_series = index_series.sort_index()

            # Convert USD indexes to BRL
            if index_name in {'NASDAQ', 'S&P500'}:
                index_series = pd.merge(index_series, usd_brl_df, on='date', how='left')
                index_series[index_name] *= index_series['usd_brl'].astype(float)
                index_series.index = index_series['date']

            index_series = index_series[[index_name]]

            # Build cumulative index from percentage rates
            if index_name in {'IPCA', 'CDI'}:
                index_series = self._build_index_from_percent(index_series)

            returns_df = calculate_acc_returns_from_prices(index_series)
            if index_history_returns_df.empty:
                index_history_returns_df = returns_df
            else:
                index_history_returns_df = index_history_returns_df.join(returns_df, how='outer')

        index_history_returns_df = index_history_returns_df.reset_index().rename(
            columns={'index': 'date'}
        )

        result = df_to_named_dict(index_history_returns_df)
        return result

    @staticmethod
    def _build_index_from_percent(
        series: pd.Series,
        base_value: float = 100.0,
    ) -> pd.Series:
        pct_series = series.fillna(0) / 100
        return base_value * (1 + pct_series).cumprod()

    async def get_usd_brl_history(self, start_date=None, as_df=True) -> pd.DataFrame:
        min_required_date = start_date or (pd.Timestamp.today() - pd.DateOffset(years=10))
        async with self.uow as uow:
            history = await uow.market_data.get_usd_brl_history(
                pd.Timestamp(min_required_date).date()
            )
        if as_df:
            return usd_brl_history_to_df(history)
        return usd_brl_history_to_payload(history)
