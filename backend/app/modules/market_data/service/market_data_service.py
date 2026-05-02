# app/modules/market_data/service/market_data_service.py
"""
Market data service - handles market indexes, USD/BRL history, and asset quotes.
"""

from datetime import datetime
from decimal import Decimal

import pandas as pd
from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.infra.db.models.asset import Currency
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.constants.currency import CURRENCY_MAP
from app.infra.db.models.constants.index import INDEX
from app.infra.db.models.market_data import Index, IndexHistory
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.lib.finance.returns import calculate_acc_returns_from_prices
from app.lib.utils.df import df_to_named_dict, rows_to_df
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.repositories.market_data_repository import (
    MarketDataRepository,
)


class MarketDataService:
    
    def __init__(self, session):
        self.session = session
        self.repo = MarketDataRepository(session)
        self.cache = RedisService()
        self.market_data_provider = MarketDataProvider()
    
    async def list_indexes(self):
        base_repo = SQLAlchemyRepository(self.session)
        indexes = await base_repo.get(Index)
        return indexes

    async def list_currencies(self):
        base_repo = SQLAlchemyRepository(self.session)
        currencies = await base_repo.get(Currency, order_by='code')
        return currencies

    USD_INDEXES = {INDEX.SP500, INDEX.NASDAQ}

    async def get_index_history(self, start_date: pd.Timestamp = None, index_id: int = None) -> pd.Series:
        """
        Returns a price-like Series with DatetimeIndex for a given index.
        For rate-based indexes (CDI, IPCA), builds a cumulative index from daily rates.
        For USD-based indexes (S&P500, NASDAQ), converts to BRL.
        For price-based indexes (IBOV, etc.), returns the value directly.
        """
        df = await self.repo.get_index_history(start_date, index_id=index_id)
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
            values = values * df['usdbrl'].values

        values.index = df['date'].values
        values.index.name = 'date'
        return values
        

    @cached(key_prefix="indexes_history", cache=lambda self: self.cache, ttl=3600)
    async def get_indexes_history(self, start_date: pd.Timestamp = None) -> pd.DataFrame:
        return await self.compute_indexes_history(start_date)

    async def compute_indexes_history(self, start_date: pd.Timestamp = None):

        start_date = start_date or pd.Timestamp(datetime.today()) - pd.DateOffset(years=5)
        index_history_df = rows_to_df(
            await self.repo.get_index_history(start_date),
            datetime_cols=['date'],
        )

        index_history_returns_df = pd.DataFrame()

        # Get USD/BRL for converting USD indexes to BRL
        usdbrl_df = index_history_df[index_history_df['index_name'] == 'USD/BRL'].copy()
        usdbrl_df['usdbrl'] = usdbrl_df['value'].astype(float)
        usdbrl_df = usdbrl_df[['date', 'usdbrl']]

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

    def _build_index_from_percent(self, series: pd.Series, base_value: float = 100.0) -> pd.Series:
        pct_series = series.fillna(0) / 100
        return base_value * (1 + pct_series).cumprod()

    async def consolidate_market_indexes_history(self):
        logger.info('Consolidando histórico de índices de mercado')
        
        indexes = await self.repo.get_all(Index, relations=['currency'])

        for index in indexes:
            try:
                await self._consolidate_index(index)
            except Exception as e:
                logger.warning(f'Falha ao consolidar {index.symbol}: {e}')

    async def _consolidate_index(self, index: Index):
        most_recent = await self.repo.get(
            IndexHistory,
            by={'index_id': index.id},
            order_by='date desc',
            first=True,
        )

        init_date = most_recent.date - pd.DateOffset(days=10) if most_recent else None

        history_df = await self.market_data_provider.get_series_historical_data(
            index, init_date=init_date
        )
        history_df = history_df.copy()

        history_df = self._extend_indexes_to_today(history_df, index.id)
        history_df['index_id'] = index.id
        cols = [col for col in IndexHistory.COLUMNS if col in history_df.columns]
        history_df = history_df[cols]

        history = history_df.to_dict(orient='records')
        await self.repo.upsert_bulk(IndexHistory, history, unique_columns=['index_id', 'date'])
        await self.session.commit()
        logger.info(f'{index.short_name} consolidado')

    def _extend_indexes_to_today(self, history_df: pd.DataFrame, index_id) -> pd.DataFrame:
        df = history_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        full_range = pd.DataFrame({
            'date': pd.date_range(start=df['date'].min(), end=datetime.today(), freq='D')
        })
        df = pd.merge(full_range, df, on='date', how='left')

        # For interest rates, missing days should be 0%
        if index_id in {INDEX.IPCA, INDEX.CDI}:
            df['close'] = df['close'].fillna(0)

        df['close'] = df['close'].ffill()
        return df

    async def get_usd_brl_history(self, start_date=None, as_df=True) -> pd.DataFrame:
        min_required_date = start_date or (pd.Timestamp.today() - pd.DateOffset(years=10))

        usdbrl = await self.repo.get(
            IndexHistory,
            by={'index_id': INDEX.USDBRL, 'date__gte': min_required_date},
        )
        if not usdbrl:
            raise ValueError('USD/BRL history not found')
        
        payload = [
            {
                "date": o.date.isoformat(),
                "usdbrl": float(o.close) if isinstance(o.close, Decimal) else (float(o.close) if o.close is not None else None),
            }
            for o in usdbrl
        ]

        if as_df:
            df = pd.DataFrame(payload)
            df['date'] = pd.to_datetime(df['date'])
            return df
        return payload

    async def get_asset_quotes(
        self,
        ticker: str,
        asset_type: str | None = None,
        exchange: str | None = None,
        date: str = None,
        start_date: str = None,
        end_date: str = None,
        treasury_type: str = None,
        treasury_maturity_date: str = None
    ):
        return await self.market_data_provider.get_asset_quotes(
            ticker,
            asset_type,
            exchange,
            date,
            start_date,
            end_date,
            treasury_type=treasury_type,
            treasury_maturity_date=treasury_maturity_date,
        )

    async def get_asset_prices(self, asset, init_date) -> pd.DataFrame:
        """Return native-currency close-price history for ``asset``.

        Translates the ORM ``Asset`` into the primitive arguments accepted by
        :meth:`get_asset_quotes`, fetches OHLCV quotes from the underlying
        provider and normalizes the result: extends to today (forward-filling
        missing days) and maps the provider's currency code to the ``CURRENCY``
        enum id.

        Output columns: ``date``, ``close``, ``currency``.
        """
        asset_type_id = asset.asset_type_id

        kwargs: dict = {
            'ticker': asset.ticker,
            'asset_type': asset_type_id,
            'start_date': init_date,
        }
        if asset.exchange is not None:
            kwargs['exchange'] = asset.exchange.code
        if asset_type_id == ASSET_TYPE.PREV:
            kwargs['ticker'] = asset.fund.legal_id
        if asset_type_id == ASSET_TYPE.TREASURY:
            kwargs['treasury_type'] = asset.treasury_bond.type.name
            kwargs['treasury_maturity_date'] = asset.treasury_bond.maturity_date

        try:
            response = await self.market_data_provider.get_asset_quotes(**kwargs)
        except NotFoundError:
            return pd.DataFrame()

        quotes = response.get('quotes') or []
        if not quotes:
            return pd.DataFrame()

        prices_df = pd.DataFrame(quotes)
        prices_df['currency'] = response.get('currency')
        return self._normalize_prices(prices_df)

    async def get_fii_dividends_df(self, tickers: list, max: bool = True) -> pd.DataFrame:
        """Return FII dividends fetched from the market-data provider."""
        return await self.market_data_provider.get_fii_dividends_df(tickers, max=max)

    @staticmethod
    def _normalize_prices(prices_df: pd.DataFrame) -> pd.DataFrame:
        df = prices_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        full_range = pd.DataFrame({
            'date': pd.date_range(start=df['date'].min(), end=datetime.today(), freq='D')
        })
        df = pd.merge(full_range, df, on='date', how='left')
        df['close'] = df['close'].ffill()
        df = df[['date', 'close', 'currency']]
        df['currency'] = df['currency'].map(CURRENCY_MAP).ffill()
        return df
        df['currency'] = df['currency'].map(CURRENCY_MAP).ffill()
        return df
