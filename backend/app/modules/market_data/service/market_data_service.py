# app/modules/market_data/service/market_data_service.py
"""
Market data service - handles market indexes, USD/BRL history, and asset quotes.
"""

from datetime import date
from typing import ClassVar

import pandas as pd

from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.lib.finance.returns import calculate_acc_returns_from_prices
from app.lib.utils.df import df_to_named_dict, rows_to_df
from app.modules.market_data.domain.assets import Currency
from app.modules.market_data.domain.constants import CURRENCY, CURRENCY_MAP, SERIES
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.market_data.domain.usd_brl import usd_brl_payload_to_df
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService

SERIES_HISTORY_CACHE_PREFIX = 'series_history_v3'

#: O começo do mundo, para esta aplicação. Não é um recorte: é o piso de uma
#: cláusula que o SQL precisa ter, escolhido antes de qualquer série existir --
#: a mais antiga do banco é o câmbio, de 1984. Cada série continua começando
#: no dia em que começa.
_EARLIEST_SERIES_DATE = '1900-01-01'


class MarketDataReadService:
    def __init__(
        self,
        uow: UnitOfWork,
        usd_brl: UsdBrlReadService,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.usd_brl = usd_brl
        self.cache = cache or RedisService()

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

    USD_SERIES: ClassVar[set[int]] = {SERIES.SP500, SERIES.NASDAQ}

    async def get_series_history_values(
        self,
        start_date: pd.Timestamp = None,
        series_id: int | None = None,
        currency: str = 'BRL',
    ) -> pd.Series:
        """
        Returns a price-like Series in ``currency`` with DatetimeIndex.

        For rate-based indexes (CDI, IPCA), builds a cumulative index from daily rates.
        Price levels are then restated through the historical USD/BRL rate when
        their source currency differs from the requested one.
        """
        target_currency_id = self._currency_id(currency)
        async with self.uow as uow:
            rows = await uow.market_data.get_series_history_values(start_date, series_id=series_id)
        df = rows_to_df(rows, datetime_cols=['date'])
        if df.empty:
            return pd.Series(dtype=float, name='value')

        df = df.sort_values('date')
        df['value'] = df['value'].astype(float)

        if series_id in {SERIES.IPCA, SERIES.CDI}:
            df['value'] = self._build_level_from_percent(df['value'])

        source_currency_id = self._series_currency_id(df, series_id=series_id)
        if source_currency_id != target_currency_id:
            usd_brl_df = usd_brl_payload_to_df(await self.usd_brl.get_full_history())
            df = self._restated_level(
                df[['date', 'value']],
                source_currency_id=source_currency_id,
                target_currency_id=target_currency_id,
                usd_brl_df=usd_brl_df,
            )

        values = df['value'].copy()
        values.index = df['date'].values
        values.index.name = 'date'
        return values

    @cached(key_prefix=SERIES_HISTORY_CACHE_PREFIX, cache=lambda self: self.cache, ttl=3600)
    async def get_all_series_history(
        self,
        start_date: pd.Timestamp = None,
        currency: str = 'BRL',
    ) -> dict[str, list[dict]]:
        return await self.compute_indexes_history(start_date, currency)

    async def compute_indexes_history(
        self,
        start_date: pd.Timestamp = None,
        currency: str = 'BRL',
    ):
        target_currency_id = self._currency_id(currency)
        # Sem recorte, a série inteira. O corte de cinco anos que morava aqui
        # não era uma decisão sobre o dado -- o banco tem S&P 500 e IBOVESPA
        # desde 1995 e câmbio desde 1984 --, era um limite silencioso: o botão
        # "Max" do gráfico mostrava o máximo do que a rota tinha mandado, e não
        # o máximo do que existe. Quem escolhe a janela é quem desenha, e cada
        # série ainda começa quando começa.
        start_date = start_date or pd.Timestamp(_EARLIEST_SERIES_DATE)
        async with self.uow as uow:
            index_history_rows = await uow.market_data.get_series_history_values(start_date)
        index_history_df = rows_to_df(index_history_rows, datetime_cols=['date'])

        index_history_returns_df = pd.DataFrame()

        # USD/BRL is used here as the return of holding USD. In BRL it follows
        # the exchange rate; in USD its level is always 1, hence a 0% return.
        full_usd_brl_df = usd_brl_payload_to_df(await self.usd_brl.get_full_history())
        usd_brl_df = full_usd_brl_df[full_usd_brl_df['date'] >= pd.Timestamp(start_date)].copy()
        usd_series_df = usd_brl_df[['date', 'usd_brl']].rename(columns={'usd_brl': 'value'}).copy()
        if target_currency_id == CURRENCY.USD:
            usd_series_df['value'] = 1.0
        usd_series_df['index_name'] = 'USD/BRL'
        usd_series_df['currency_id'] = None
        index_history_df = pd.concat(
            [
                index_history_df,
                usd_series_df[['date', 'value', 'index_name', 'currency_id']],
            ],
            ignore_index=True,
        )

        for index_name in index_history_df['index_name'].unique():
            index_series = index_history_df[index_history_df['index_name'] == index_name].copy()
            index_series = index_series.sort_values('date')
            index_series['value'] = index_series['value'].astype(float)

            # Build cumulative index from percentage rates
            if index_name in {'IPCA', 'CDI'}:
                index_series['value'] = self._build_level_from_percent(index_series['value'])

            if index_name != 'USD/BRL':
                source_currency_id = self._series_currency_id(
                    index_series,
                    index_name=index_name,
                )
                index_series = self._restated_level(
                    index_series[['date', 'value']],
                    source_currency_id=source_currency_id,
                    target_currency_id=target_currency_id,
                    usd_brl_df=full_usd_brl_df,
                )

            if index_series.empty:
                continue

            index_series = index_series.set_index('date')[['value']].rename(
                columns={'value': index_name}
            )

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
    def _currency_id(currency: str) -> CURRENCY:
        target_currency_id = CURRENCY_MAP.get(currency.upper())
        if target_currency_id is None:
            raise ValueError(f'Unsupported currency: {currency}')
        return target_currency_id

    def _series_currency_id(
        self,
        series_df: pd.DataFrame,
        series_id: int | None = None,
        index_name: str | None = None,
    ) -> CURRENCY:
        if 'currency_id' in series_df:
            currency_ids = series_df['currency_id'].dropna()
            if not currency_ids.empty:
                return CURRENCY(int(currency_ids.iloc[0]))

        is_usd_series = series_id in self.USD_SERIES or index_name in {'NASDAQ', 'S&P500'}
        return CURRENCY.USD if is_usd_series else CURRENCY.BRL

    @staticmethod
    def _restated_level(
        level_df: pd.DataFrame,
        *,
        source_currency_id: CURRENCY,
        target_currency_id: CURRENCY,
        usd_brl_df: pd.DataFrame,
    ) -> pd.DataFrame:
        if source_currency_id == target_currency_id:
            return level_df[['date', 'value']].copy()
        if usd_brl_df.empty:
            return level_df.iloc[0:0][['date', 'value']].copy()

        rate_column = 'usd_brl' if target_currency_id == CURRENCY.BRL else 'brl_usd'
        values = level_df[['date', 'value']].sort_values('date').copy()
        rates = usd_brl_df[['date', rate_column]].sort_values('date').copy()
        values = pd.merge_asof(values, rates, on='date', direction='backward')
        values = values.dropna(subset=[rate_column])
        values['value'] *= values[rate_column].astype(float)
        return values[['date', 'value']]

    @staticmethod
    def _build_level_from_percent(
        series: pd.Series,
        base_value: float = 100.0,
    ) -> pd.Series:
        pct_series = series.fillna(0) / 100
        return base_value * (1 + pct_series).cumprod()

    async def get_usd_brl_history(self, start_date=None, as_df=True) -> pd.DataFrame:
        """The exchange rate, from the cached reader rather than its own query.

        The default ten-year window is kept: it bounds what the index frames
        merge against and what the compatibility route returns, even though the
        reader now holds the whole table either way.
        """
        min_required_date = start_date or (pd.Timestamp.today() - pd.DateOffset(years=10))
        payload = await self.usd_brl.get_history(start_date=pd.Timestamp(min_required_date).date())
        if as_df:
            return usd_brl_payload_to_df(payload)
        return payload
