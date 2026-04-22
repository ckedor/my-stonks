# app/infra/integrations/alpha_vantage_client.py
import asyncio

import pandas as pd
from alpha_vantage.foreignexchange import ForeignExchange
from alpha_vantage.timeseries import TimeSeries
from app.config.settings import settings
from app.infra.http import raise_for_provider

PROVIDER = 'alpha_vantage'


class AlphaVantageClient:
    """
    AlphaVantage client wrapper.
    Uses asyncio.to_thread to run synchronous alpha_vantage library calls
    without blocking the event loop.
    """

    def __init__(self):
        self.alpha_vantage_key = settings.ALPHAVANTAGE_KEY

    def _get_price_history_df_sync(self, symbol):
        """Synchronous version - called via to_thread."""
        try:
            ts = TimeSeries(key=self.alpha_vantage_key)
            data, metadata = ts.get_daily(symbol=symbol, outputsize='full')
            df = pd.DataFrame.from_dict(data).T
            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)
            df['open'] = df['1. open'].astype(float)
            df['high'] = df['2. high'].astype(float)
            df['low'] = df['3. low'].astype(float)
            df['close'] = df['4. close'].astype(float)

            df = df[['open', 'high', 'low', 'close']]
            df.rename(columns={'Unnamed: 0': 'date'}, inplace=True)

            df = df.reset_index()
            df = df.rename(columns={'index': 'date'})

            if symbol.endswith('.SA'):
                df['currency'] = 'BRL'
            else:
                df['currency'] = 'USD'

            df = df.set_index('date').asfreq('D').reset_index()
            df[['open', 'high', 'low', 'close']] = df[
                ['open', 'high', 'low', 'close']
            ].ffill()

            return df[['date', 'open', 'high', 'low', 'close', 'currency']]

        except Exception as e:
            raise_for_provider(e, provider=PROVIDER)

    async def get_price_history_df(self, symbol):
        """Async wrapper using to_thread to avoid blocking."""
        return await asyncio.to_thread(self._get_price_history_df_sync, symbol)

    async def get_quotes(
        self,
        symbol: str,
        init_date=None,
        end_date=None,
        is_b3=False,
    ) -> dict:
        if is_b3 and not symbol.endswith('.SA'):
            symbol += '.SA'
            
        df = await self.get_price_history_df(symbol)
        if end_date:
            end_date = pd.to_datetime(end_date).normalize()
            df = df[df['date'] <= end_date]
        if init_date:
            init_date = pd.to_datetime(init_date).normalize()
            df = df[df['date'] >= init_date]
        return {
            'ticker': symbol,
            'currency': df['currency'].iloc[0] if not df.empty else None,
            'quotes': df[['date', 'open', 'high', 'low', 'close']].to_dict(orient='records'),
        }

    def _get_sp500_history_sync(self):
        """Synchronous version."""
        try:
            ts = TimeSeries(key=self.alpha_vantage_key, output_format='pandas')
            data, metadata = ts.get_daily(symbol='SPY', outputsize='full')

            data.index = pd.to_datetime(data.index)
            data.sort_index(inplace=True)
            data['preco'] = data['4. close'].astype(float)

            df = data[['preco']]
            df['data'] = df.index

            df.reset_index(drop=True, inplace=True)

            return df[['data', 'preco']]

        except Exception as e:
            raise_for_provider(e, provider=PROVIDER)

    async def get_sp500_history(self):
        """Async wrapper."""
        return await asyncio.to_thread(self._get_sp500_history_sync)

    def _get_usd_brl_exchange_rate_sync(self):
        """Synchronous version."""
        try:
            fx = ForeignExchange(key=self.alpha_vantage_key)
            data, _ = fx.get_currency_exchange_daily(
                from_symbol='USD', to_symbol='BRL', outputsize='full'
            )
            df = pd.DataFrame.from_dict(data).T
            df.index = pd.to_datetime(df.index)
            df.sort_index(inplace=True)
            df['BRL/USD'] = df['4. close'].astype(float)
            df = df.reset_index()
            df = df.rename(columns={'index': 'data'})
            return df[['data', 'BRL/USD']]
        except Exception as e:
            raise_for_provider(e, provider=PROVIDER)

    async def get_usd_brl_exchange_rate_alpha_vantage(self):
        """Async wrapper."""
        return await asyncio.to_thread(self._get_usd_brl_exchange_rate_sync)
