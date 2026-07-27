# app/infra/integrations/brapi_client.py
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from app.config.settings import settings
from app.infra.http import AsyncHttpClient
from app.lib.utils.df import extend_values_to_today


class BrapiClient:  # noqa: PLR0904 - the public methods mirror the upstream API
    """Client for the brapi REST API."""

    def __init__(self):
        self.http = AsyncHttpClient(
            provider='brapi',
            base_url='https://brapi.dev/api',
            timeout=15.0,
            headers={'Authorization': f'Bearer {settings.BRAPI_API_TOKEN}'},
        )

    async def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return await self.http.request('GET', endpoint, params=params)

    # Crypto, currencies and dictionary
    async def get_crypto(self, **params):
        return await self._get('/v2/crypto', params)

    async def get_crypto_available(self, **params):
        return await self._get('/v2/crypto/available', params)

    async def get_currency(self, **params):
        return await self._get('/v2/currency', params)

    async def get_currency_historical(self, **params):
        return await self._get('/v2/currency/historical', params)

    async def get_currency_available(self, **params):
        return await self._get('/v2/currency/available', params)

    async def get_dictionary(self, **params):
        return await self._get('/v2/dictionary', params)

    # Real estate funds
    async def list_fiis(self, **params):
        return await self._get('/v2/fii/list', params)

    async def get_fii_indicators(self, **params):
        return await self._get('/v2/fii/indicators', params)

    async def get_fii_indicators_history(self, **params):
        return await self._get('/v2/fii/indicators/history', params)

    async def get_fii_historical(self, **params):
        return await self._get('/v2/fii/historical', params)

    async def get_fii_portfolio(self, **params):
        return await self._get('/v2/fii/portfolio', params)

    async def get_fii_properties(self, **params):
        return await self._get('/v2/fii/properties', params)

    async def get_fii_properties_history(self, **params):
        return await self._get('/v2/fii/properties/history', params)

    async def get_fii_portfolio_history(self, **params):
        return await self._get('/v2/fii/portfolio/history', params)

    async def get_fii_reports(self, **params):
        return await self._get('/v2/fii/reports', params)

    async def get_fii_dividends(self, **params):
        return await self._get('/v2/fii/dividends', params)

    async def get_fii_financials(self, **params):
        return await self._get('/v2/fii/financials', params)

    async def get_fii_annual_reports(self, **params):
        return await self._get('/v2/fii/annual-reports', params)

    # Other funds
    async def list_funds(self, **params):
        return await self._get('/v2/funds/list', params)

    async def get_fund_indicators(self, **params):
        return await self._get('/v2/funds/indicators', params)

    async def get_fund_nav_history(self, **params):
        return await self._get('/v2/funds/nav/history', params)

    async def get_fund_profile(self, **params):
        return await self._get('/v2/funds/profile', params)

    async def get_fund_dividends(self, **params):
        return await self._get('/v2/funds/dividends', params)

    async def get_fiagro_reports(self, **params):
        return await self._get('/v2/funds/fiagro/reports', params)

    async def get_fiagro_portfolio(self, **params):
        return await self._get('/v2/funds/fiagro/portfolio', params)

    async def get_fund_portfolio(self, **params):
        return await self._get('/v2/funds/portfolio', params)

    async def get_fidc_reports(self, **params):
        return await self._get('/v2/funds/fidc/reports', params)

    async def get_fidc_portfolio(self, **params):
        return await self._get('/v2/funds/fidc/portfolio', params)

    async def get_fip_reports(self, **params):
        return await self._get('/v2/funds/fip/reports', params)

    # Futures options
    async def get_future_option_expirations(self, **params):
        return await self._get('/v2/futures/options/expirations', params)

    async def get_future_option_strikes(self, **params):
        return await self._get('/v2/futures/options/strikes', params)

    async def get_future_option_chain(self, **params):
        return await self._get('/v2/futures/options/chain', params)

    async def get_future_option_historical(self, **params):
        return await self._get('/v2/futures/options/historical', params)

    async def get_future_option_analytics(self, **params):
        return await self._get('/v2/futures/options/analytics', params)

    async def get_future_option_analytics_history(self, **params):
        return await self._get('/v2/futures/options/analytics/history', params)

    # Futures
    async def list_futures(self, **params):
        return await self._get('/v2/futures/list', params)

    async def get_future_quotes(self, **params):
        return await self._get('/v2/futures/quote', params)

    async def get_future_specs(self, **params):
        return await self._get('/v2/futures/specs', params)

    async def get_future_historical(self, **params):
        return await self._get('/v2/futures/historical', params)

    async def get_future_term_structure(self, **params):
        return await self._get('/v2/futures/term-structure', params)

    # Macroeconomics and backwards-compatible endpoints
    async def get_inflation(self, **params):
        return await self._get('/v2/inflation', params)

    async def get_inflation_available(self, **params):
        return await self._get('/v2/inflation/available', params)

    async def get_macro_available(self, **params):
        return await self._get('/v2/macro/available', params)

    async def get_macro_series(self, **params):
        return await self._get('/v2/macro', params)

    async def get_macro_latest(self, **params):
        return await self._get('/v2/macro/latest', params)

    async def get_prime_rate(self, **params):
        return await self._get('/v2/prime-rate', params)

    async def get_prime_rate_available(self, **params):
        return await self._get('/v2/prime-rate/available', params)

    # Equity options
    async def get_option_expirations(self, **params):
        return await self._get('/v2/options/expirations', params)

    async def get_option_strikes(self, **params):
        return await self._get('/v2/options/strikes', params)

    async def get_option_chain(self, **params):
        return await self._get('/v2/options/chain', params)

    async def get_option_historical(self, **params):
        return await self._get('/v2/options/historical', params)

    async def get_option_analytics(self, **params):
        return await self._get('/v2/options/analytics', params)

    async def get_option_analytics_history(self, **params):
        return await self._get('/v2/options/analytics/history', params)

    # Stocks
    async def get_stock_quotes(self, **params):
        return await self._get('/v2/stocks/quote', params)

    async def get_stock_historical(self, **params):
        return await self._get('/v2/stocks/historical', params)

    async def get_stock_dividends(self, **params):
        return await self._get('/v2/stocks/dividends', params)

    async def get_stock_profile(self, **params):
        return await self._get('/v2/stocks/profile', params)

    async def get_stock_statistics(self, **params):
        return await self._get('/v2/stocks/statistics', params)

    async def get_stock_financial_data(self, **params):
        return await self._get('/v2/stocks/financial-data', params)

    async def get_stock_balance_sheet(self, **params):
        return await self._get('/v2/stocks/balance-sheet', params)

    async def get_stock_income_statement(self, **params):
        return await self._get('/v2/stocks/income-statement', params)

    async def get_stock_cash_flow(self, **params):
        return await self._get('/v2/stocks/cash-flow', params)

    async def get_stock_value_added(self, **params):
        return await self._get('/v2/stocks/value-added', params)

    # Treasury
    async def list_treasury(self, **params):
        return await self._get('/v2/treasury/list', params)

    async def get_treasury_indicators(self, **params):
        return await self._get('/v2/treasury/indicators', params)

    async def get_treasury_indicators_history(self, **params):
        return await self._get('/v2/treasury/indicators/history', params)

    # Tickers and account
    async def get_ticker_renames(self, **params):
        return await self._get('/v2/tickers/renames', params)

    async def resolve_tickers(self, **params):
        return await self._get('/v2/tickers/resolve', params)

    async def get_ticker_coverage(self, **params):
        return await self._get('/v2/tickers/coverage', params)

    async def get_tickers(self, **params):
        return await self._get('/v2/tickers', params)

    async def get_user_usage(self, **params):
        return await self._get('/v2/user/usage', params)

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

    async def get_crypto_quotes(
        self,
        ticker: str,
        start_date=None,
        end_date=None,
        currency: str = 'USD',
        interval: str = '1d',
    ) -> Dict[str, Any]:
        """Fetch cryptocurrency OHLCV history from ``GET /api/v2/crypto``."""
        range_param = self._brapi_range_from_init_date(start_date)
        response = await self._get(
            '/v2/crypto',
            {
                'coin': ticker.upper(),
                'currency': currency,
                'range': range_param,
                'interval': interval,
            },
        )

        coins = response.get('coins') or []
        coin = next(
            (item for item in coins if item.get('coin', '').upper() == ticker.upper()),
            None,
        )
        history = coin.get('historicalDataPrice') if coin else None
        if not history:
            return {
                'ticker': ticker,
                'currency': coin.get('currency', currency) if coin else currency,
                'quotes': [],
            }

        df = pd.DataFrame(history)
        df['date'] = pd.to_datetime(df['date'], unit='s').dt.normalize()
        df = df.drop_duplicates(subset=['date']).sort_values('date')

        if start_date:
            start_date = pd.to_datetime(start_date).normalize()
            df = df[df['date'] >= start_date]
        if end_date:
            end_date = pd.to_datetime(end_date).normalize()
            df = df[df['date'] <= end_date]

        quote_columns = ['date', 'open', 'high', 'low', 'close', 'volume']
        return {
            'ticker': ticker,
            'currency': coin.get('currency', currency),
            'quotes': df[quote_columns].to_dict(orient='records'),
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
