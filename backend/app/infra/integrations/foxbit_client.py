import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode

import pandas as pd
from app.infra.http import AsyncHttpClient


class FoxbitClient:
    def __init__(self):
        self.http = AsyncHttpClient(
            provider='foxbit',
            base_url='https://api.foxbit.com.br/rest/v3',
            timeout=10.0,
        )
        self.api_key = os.getenv('FOXBIT_API_KEY')
        self.api_secret = os.getenv('FOXBIT_API_SECRET')

    def _sign(self, method: str, path: str, params: dict | None, body: dict | None):
        query_string = urlencode(params) if params else ''
        raw_body = json.dumps(body) if body else ''

        timestamp = str(int(time.time() * 1000))
        pre_hash = f'{timestamp}{method.upper()}{"/rest/v3" + path}{query_string}{raw_body}'
        signature = hmac.new(self.api_secret.encode(), pre_hash.encode(), hashlib.sha256).hexdigest()
        return signature, timestamp

    def _auth_headers(self, method: str, path: str, params: dict | None, body: dict | None) -> dict:
        signature, timestamp = self._sign(method, path, params, body)
        return {
            'X-FB-ACCESS-KEY': self.api_key,
            'X-FB-ACCESS-TIMESTAMP': timestamp,
            'X-FB-ACCESS-SIGNATURE': signature,
        }

    async def _request(self, method: str, path: str, *, params=None, json_body=None):
        headers = self._auth_headers(method, path, params, json_body)
        return await self.http.request(method, path, params=params, json=json_body, headers=headers)

    async def get_currencies(self):
        return await self._request('GET', '/currencies')

    async def get_candlesticks(
        self,
        market_symbol,
        interval='1d',
        start_time=None,
        end_time=None,
        limit=500,
    ):
        params = {'interval': interval, 'limit': limit}
        if start_time:
            params['start_time'] = start_time
        if end_time:
            params['end_time'] = end_time

        candlesticks = await self._request('GET', f'/markets/{market_symbol}/candlesticks', params=params)

        close_data = []
        for candle in candlesticks:
            close_datetime = (
                pd.to_datetime(int(candle[5]), unit='ms', utc=True)
                .tz_convert('America/Sao_Paulo')
                .tz_localize(None)
                .replace(hour=0, minute=0, second=0, microsecond=0)
            )
            close_price = float(candle[4])
            close_data.append({'data': close_datetime, 'preco': close_price})

        return pd.DataFrame(close_data)

    async def get_user_info(self):
        return await self._request('GET', '/me')

    async def get_trades(self, ticker):
        params = {'market_symbol': ticker, 'page_size': 100}
        return await self._request('GET', '/trades', params=params)

    async def aclose(self):
        await self.http.aclose()
