# app/infra/integrations/crypto_compare_client.py
from datetime import datetime

import pandas as pd
from app.config.settings import settings
from app.infra.http import AsyncHttpClient
from app.utils.df import extend_values_to_today


class CryptoCompareClient:
    def __init__(self):
        self.api_key = settings.CRYPTO_COMPARE_API_KEY
        self.http = AsyncHttpClient(
            provider='crypto_compare',
            base_url='https://data-api.cryptocompare.com',
            timeout=30.0,
            headers={'accept': 'application/json'},
        )

    async def get_crypto_price_history_df(
        self, symbol: str, market: str = 'cadli', init_date: datetime = None
    ) -> pd.DataFrame:
        if init_date is None:
            init_date = datetime(2015, 1, 1)
        instrument = symbol + '-USD'

        limit = 2000
        aggregate = 1
        all_data = []

        to_ts = int(datetime.now().timestamp())

        while True:
            params = {
                'market': market,
                'instrument': instrument,
                'limit': limit,
                'aggregate': aggregate,
                'fill': 'true',
                'apply_mapping': 'true',
                'response_format': 'JSON',
                'api_key': self.api_key,
                'to_ts': to_ts,
            }

            data = await self.http.request('GET', '/index/cc/v1/historical/days', params=params)

            if 'Data' not in data or not data['Data']:
                break

            chunk = data['Data']

            if init_date:
                chunk = [
                    item
                    for item in chunk
                    if datetime.utcfromtimestamp(item['TIMESTAMP']) >= init_date
                ]

            if not chunk:
                break

            all_data.extend(chunk)

            to_ts = chunk[0]['TIMESTAMP'] - 1
            if init_date and datetime.utcfromtimestamp(to_ts) < init_date:
                break

        df = pd.DataFrame(all_data)

        df = df.rename(
            columns={
                'TIMESTAMP': 'date',
                'OPEN': 'open',
                'CLOSE': 'close',
                'HIGH': 'high',
                'LOW': 'low',
                'VOLUME': 'volume',
            }
        )

        df['date'] = pd.to_datetime(df['date'], unit='s')
        df = df[['date', 'open', 'close', 'high', 'low', 'volume']]
        df['currency'] = 'USD'

        df = extend_values_to_today(df)
        return df

    async def get_quotes(
        self,
        ticker: str,
        start_date=None,
        end_date=None,
    ):
        history_df = await self.get_crypto_price_history_df(ticker, init_date=start_date)
        if end_date:
            end_date = pd.to_datetime(end_date).normalize()
            history_df = history_df[history_df['date'] <= end_date]
        if start_date:
            start_date = pd.to_datetime(start_date).normalize()
            history_df = history_df[history_df['date'] >= start_date]
        return {
            'ticker': ticker,
            'currency': history_df['currency'].iloc[0] if not history_df.empty else None,
            'quotes': history_df[['date', 'open', 'high', 'low', 'close']].to_dict(orient='records'),
        }

    async def aclose(self):
        await self.http.aclose()
