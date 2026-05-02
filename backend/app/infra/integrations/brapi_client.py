# app/infra/integrations/brapi_client.py
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from app.config.settings import settings
from app.infra.http import AsyncHttpClient
from app.lib.utils.df import extend_values_to_today


class BrapiClient:
    def __init__(self):
        self.http = AsyncHttpClient(
            provider='brapi',
            base_url='https://brapi.dev/api',
            timeout=15.0,
            headers={'Authorization': f'Bearer {settings.BRAPI_API_TOKEN}'},
        )

    async def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.http.request('GET', endpoint, params=params)

    async def _get_quotes(
        self, tickers: List[str], range: str = '1y', interval: str = '1d', modules: str = 'summaryProfile'
    ) -> Dict[str, Any]:
        endpoint = f'/quote/{",".join(tickers)}'
        params = {'range': range, 'interval': interval, 'modules': modules, 'fundamental': True}
        return await self._get(endpoint, params)

    async def available_stocks(self, search: Optional[str] = None):
        endpoint = '/available'
        params = {'search': search}
        return await self._get(endpoint, params)

    async def list_stocks(self, search: Optional[str] = None):
        endpoint = '/quote/list'
        params = {'search': search}
        return await self._get(endpoint, params)

    @staticmethod
    def _brapi_range_from_init_date(init_date: datetime | pd.Timestamp | None) -> str:
        if init_date is None:
            return 'max'

        today = pd.Timestamp.today().normalize()
        init_date = pd.Timestamp(init_date).normalize()
        delta_days = (today - init_date).days

        ranges = [
            ('1d', 1),
            ('5d', 5),
            ('1mo', 30),
            ('3mo', 90),
            ('6mo', 180),
            ('1y', 365),
            ('2y', 730),
            ('5y', 1825),
            ('10y', 3650),
            ('max', 36500),
        ]

        for range_name, max_days in ranges:
            if delta_days <= max_days:
                return range_name

        return 'max'

    async def _fetch_price_df(self, ticker: str, init_date, interval: str = '1d') -> pd.DataFrame:
        """Fetch raw price data without filling missing days."""
        range_param = self._brapi_range_from_init_date(init_date)
        asset_quotes = await self._get_quotes([ticker], range_param, interval)

        asset = asset_quotes['results'][0]
        history = asset.get('historicalDataPrice', [])
        df = pd.DataFrame(history)
        df['currency'] = asset.get('currency')
        df['date'] = pd.to_datetime(df['date'], unit='s').dt.normalize()
        df = df.drop_duplicates(subset=['date'])
        return df

    async def get_price_history_df(self, ticker: str, init_date, interval: str = '1d') -> pd.DataFrame:
        df = await self._fetch_price_df(ticker, init_date, interval)
        df = extend_values_to_today(df)
        return df

    async def get_quotes(
        self,
        ticker: str,
        init_date,
        end_date=None,
        interval: str = '1d'
    ) -> Dict[str, Any]:
        df = await self._fetch_price_df(ticker, init_date, interval)
        if end_date:
            end_date = pd.to_datetime(end_date).normalize()
            df = df[df['date'] <= end_date]
        if init_date:
            init_date = pd.to_datetime(init_date).normalize()
            df = df[df['date'] >= init_date]

        currency = df['currency'].iloc[0] if not df.empty else None
        quotes = df[['date', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
        return {
            'ticker': ticker,
            'currency': currency,
            'quotes': quotes,
        }

    async def get_dividends(
        self, tickers: Union[str, List[str]], range: str = '1y'
    ) -> List[Dict[str, Any]]:
        if isinstance(tickers, str):
            tickers = [tickers]
        endpoint = f'/quote/{",".join(tickers)}'
        params = {'range': range, 'interval': '1d', 'dividends': 'true'}
        response = await self._get(endpoint, params)
        dividends = []
        for result in response['results']:
            dividend_data = result.get('dividendsData', {})
            cash_dividends = dividend_data.get('cashDividends', [])
            if len(cash_dividends) <= 1:
                continue
            for cash_dividend in cash_dividends:
                date = datetime.strptime(
                    cash_dividend['paymentDate'], '%Y-%m-%dT%H:%M:%S.%fZ'
                ).date()
                dividends.append({
                    'symbol': result['symbol'],
                    'value_per_share': cash_dividend['rate'],
                    'date': date,
                    'currency': result['currency'],
                })
        return dividends

    async def aclose(self):
        await self.http.aclose()
