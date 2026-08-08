# app/modules/market_data/service/market_data_service.py
"""
Market data service - handles market indexes, USD/BRL history, and asset quotes.
"""

from datetime import datetime
import pandas as pd

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.assets import Currency
from app.modules.market_data.domain.constants import CURRENCY_MAP, INDEX
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.lib.finance.returns import calculate_acc_returns_from_prices
from app.lib.utils.df import df_to_named_dict, rows_to_df
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesType,
)
from app.modules.market_data.repositories.market_data_repository import MarketDataRepository
from app.modules.market_data.repositories.quote_repository import QuoteRepository


class MarketDataReadService:
    def __init__(
        self,
        repository: MarketDataRepository | None = None,
        cache: RedisService | None = None,
        provider: MarketDataProvider | None = None,
        quote_repository: QuoteRepository | None = None,
    ):
        self.repository = repository
        self.cache = cache or RedisService()
        self.market_data_provider = provider
        self.quote_repository = quote_repository

    def _provider(self) -> MarketDataProvider:
        if self.market_data_provider is None:
            raise RuntimeError('A provider is required for this operation')
        return self.market_data_provider

    def _read_repository(
        self,
        repository: MarketDataRepository | None = None,
    ) -> MarketDataRepository:
        resolved_repository = repository or self.repository
        if resolved_repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return resolved_repository

    async def list_indexes(self):
        indexes = await self._read_repository().get(MarketDataSeries)
        return indexes

    async def list_market_data_series(self):
        series = await self._read_repository().get(MarketDataSeries)
        return [item for item in series if item.series_type != MarketDataSeriesType.EXCHANGE_RATE]

    async def list_currencies(self):
        currencies = await self._read_repository().get(Currency, order_by='code')
        return currencies

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
        df = await self._read_repository().get_index_history(start_date, index_id=index_id)
        df = rows_to_df(df, datetime_cols=['date'])
        df = df.sort_values('date')
        df['value'] = df['value'].astype(float)

        if index_id in {INDEX.IPCA, INDEX.CDI}:
            values = self._build_index_from_percent(df['value'])
        else:
            values = df['value']

        if index_id in self.USD_INDEXES:
            usdbrl_df = await self.get_usd_brl_history(start_date)
            df = df.merge(usdbrl_df[['date', 'usdbrl']], on='date', how='left')
            df['usdbrl'] = df['usdbrl'].ffill()
            values *= df['usdbrl'].values

        values.index = df['date'].values
        values.index.name = 'date'
        return values

    @cached(key_prefix='indexes_history', cache=lambda self: self.cache, ttl=3600)
    async def get_indexes_history(self, start_date: pd.Timestamp = None) -> pd.DataFrame:
        return await self.compute_indexes_history(start_date)

    async def compute_indexes_history(self, start_date: pd.Timestamp = None):
        start_date = start_date or pd.Timestamp(datetime.today()) - pd.DateOffset(years=5)
        index_history_df = rows_to_df(
            await self._read_repository().get_index_history(start_date),
            datetime_cols=['date'],
        )

        index_history_returns_df = pd.DataFrame()

        # Get USD/BRL for converting USD indexes to BRL
        usdbrl_df = await self.get_usd_brl_history(start_date)
        usd_series_df = usdbrl_df.rename(columns={'usdbrl': 'value'}).copy()
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
                index_series = pd.merge(index_series, usdbrl_df, on='date', how='left')
                index_series[index_name] *= index_series['usdbrl'].astype(float)
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

    async def get_usd_brl_history(
        self,
        start_date=None,
        as_df=True,
        *,
        repository: MarketDataRepository | None = None,
    ) -> pd.DataFrame:
        min_required_date = start_date or (pd.Timestamp.today() - pd.DateOffset(years=10))

        usdbrl = await self._read_repository(repository).get_usd_brl_history(
            pd.Timestamp(min_required_date).date()
        )
        if not usdbrl:
            return pd.DataFrame(columns=['date', 'usdbrl']) if as_df else []

        payload = [
            {
                'date': o.date.isoformat(),
                'usdbrl': float(o.usd_to_brl_rate),
            }
            for o in usdbrl
        ]

        if as_df:
            df = pd.DataFrame(payload)
            df['date'] = pd.to_datetime(df['date'])
            return df
        return payload

    async def get_asset_close_prices(
        self,
        *,
        asset_id: int,
        ticker: str,
        init_date,
        quote_repository: QuoteRepository | None = None,
    ) -> pd.DataFrame:
        """Return persisted native-currency close prices for one asset.

        This read never falls back to an external provider. Missing history is
        explicit so callers can run quote ingestion before portfolio
        consolidation.
        """
        resolved_repository = quote_repository or self.quote_repository
        if resolved_repository is None:
            raise RuntimeError('A quote repository is required for persisted prices')
        start_date = pd.Timestamp(init_date).date()
        quotes = await resolved_repository.get_quotes([asset_id], start_date=start_date)
        if not quotes:
            raise NotFoundError(
                f'No persisted quotes found for asset {ticker}',
                context={'asset_id': asset_id, 'ticker': ticker},
            )
        close_prices_df = pd.DataFrame([
            {
                'date': quote.date,
                'close': quote.close,
                'currency': quote.currency_id,
            }
            for quote in quotes
            if quote.close is not None
        ])
        if close_prices_df.empty:
            raise NotFoundError(
                f'No persisted close prices found for asset {ticker}',
                context={'asset_id': asset_id, 'ticker': ticker},
            )
        return self._normalize_close_prices(close_prices_df, currency_is_id=True)

    async def get_fii_dividends_df(self, tickers: list, max: bool = True) -> pd.DataFrame:
        """Return FII dividends fetched from the market-data provider."""
        return await self._provider().get_fii_dividends_df(tickers, max=max)

    async def aclose(self) -> None:
        if self.market_data_provider is not None:
            await self.market_data_provider.close()

    @staticmethod
    def _normalize_close_prices(
        close_prices_df: pd.DataFrame,
        *,
        currency_is_id: bool = False,
    ) -> pd.DataFrame:
        df = close_prices_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        full_range = pd.DataFrame({
            'date': pd.date_range(start=df['date'].min(), end=datetime.today(), freq='D')
        })
        df = pd.merge(full_range, df, on='date', how='left')
        df['close'] = df['close'].ffill()
        df = df[['date', 'close', 'currency']]
        if currency_is_id:
            df['currency'] = df['currency'].ffill()
        else:
            df['currency'] = df['currency'].map(CURRENCY_MAP).ffill()
        return df


class MarketDataCacheService:
    def __init__(self, *, read_service: MarketDataReadService, cache: RedisService) -> None:
        self.read_service = read_service
        self.cache = cache

    async def warm_indexes_history(self) -> None:
        indexes_history = await self.read_service.compute_indexes_history()
        await self.cache.set_json('indexes_history', indexes_history)


MarketDataService = MarketDataReadService
