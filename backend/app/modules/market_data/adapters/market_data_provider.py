# app/modules/market_data/service/market_data_provider.py
import asyncio
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pandas as pd

from app.core.exceptions import ValidationError
from app.modules.market_data.domain.constants import ASSET_TYPE, FII_SEGMENT, INDEX
from app.infra.integrations.bcb_client import BCBClient
from app.infra.integrations.brapi_client import BrapiClient
from app.infra.integrations.crypto_compare_client import CryptoCompareClient
from app.infra.integrations.mais_retorno_client import MaisRetornoClient
from app.infra.integrations.status_invest_client import StatusInvestClient
from app.infra.integrations.tesouro_client import TesouroClient
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.market_data.domain.quote import (
    FetchedQuotes,
    Quote,
)

STATUSINVEST_TO_INTERNAL_SEGMENT = {
    'Shoppings': FII_SEGMENT.SHOPPING,
    'Papéis': FII_SEGMENT.RECEIVABLES,
    'Lajes Corporativas': FII_SEGMENT.CORPORATE,
    'Fundo de Fundos': FII_SEGMENT.FOF,
    'Misto': FII_SEGMENT.HYBRID,
    'Imóveis Residenciais': FII_SEGMENT.RESIDENTIAL,
    'Imóveis Industriais e Logísticos': FII_SEGMENT.LOGISTICS,
    'Indefinido': FII_SEGMENT.OTHERS,
    'Imóveis Comerciais - Outros': FII_SEGMENT.HYBRID,
    'Serviços Financeiros Diversos': FII_SEGMENT.RECEIVABLES,
    'Agências de Bancos': FII_SEGMENT.BANK_AGENCIES,
    'Hotéis': FII_SEGMENT.HOTELS,
    'Fundo de Desenvolvimento': FII_SEGMENT.DEVELOPMENT,
    'Incorporações': FII_SEGMENT.INCORPORATIONS,
    'Varejo': FII_SEGMENT.RETAIL,
    'Outros': FII_SEGMENT.OTHERS,
    'Educacional': FII_SEGMENT.EDUCATIONAL,
    'Logística': FII_SEGMENT.LOGISTICS,
    'Hospitalar': FII_SEGMENT.HOSPITAL,
    'Exploração de Imóveis': FII_SEGMENT.HYBRID,
    'Tecidos. Vestuário e Calçados': FII_SEGMENT.SHOPPING,
}

MARKET_TIMEZONE = ZoneInfo('America/Sao_Paulo')


class MarketDataProvider:
    quote_source = 'brapi'

    def __init__(self):
        self.brapi_client = BrapiClient()
        self.bcb_api_client = BCBClient()
        self.mais_retorno_client = MaisRetornoClient()
        self.crypto_compare_client = CryptoCompareClient()
        self.status_invest_client = StatusInvestClient()
        self.tesouro_client = TesouroClient()

    async def get_series_historical_data(
        self, series: MarketDataSeries, init_date: pd.Timestamp = None
    ) -> pd.DataFrame:
        """
        Fetch market-index history.
        """
        history_df = None

        if series.id in {INDEX.CDI, INDEX.IPCA}:
            history_df = await self.bcb_api_client.get_market_index_history_df(
                series.symbol, init_date=init_date
            )
            history_df.rename(columns={'value': 'close'}, inplace=True)

        elif series.id == INDEX.IFIX:
            history_df = await self._fetch_market_index_history(
                series.symbol,
                init_date=init_date,
            )

        else:
            history_df = await self.brapi_client.get_quotes_df(
                series.symbol, init_date=init_date, interval='1d'
            )

        return history_df

    @staticmethod
    def get_series_source(series: MarketDataSeries) -> str:
        if series.id in {INDEX.CDI, INDEX.IPCA}:
            return 'bcb'
        return 'brapi'

    async def _fetch_market_index_history(
        self,
        symbol: str,
        *,
        init_date: pd.Timestamp | date | None,
    ) -> pd.DataFrame:
        today = datetime.now(MARKET_TIMEZONE).date()
        parameters = {
            'symbols': symbol,
            'range': 'max' if init_date is None else None,
            'interval': '1d',
            'startDate': pd.Timestamp(init_date).date().isoformat() if init_date else None,
            'endDate': today.isoformat() if init_date else None,
            'sortOrder': 'asc',
        }
        response = await self.brapi_client.get_stock_historical(**self._without_none(parameters))
        result = next(
            (
                item
                for item in response.get('results', [])
                if item.get('requestedSymbol', '').upper() == symbol.upper()
                or item.get('symbol', '').upper() == symbol.upper()
            ),
            None,
        )
        history = (result or {}).get('data', {}).get('historicalDataPrice', [])
        history_df = pd.DataFrame(history)
        if history_df.empty:
            return pd.DataFrame(columns=['date', 'open', 'high', 'low', 'close'])
        history_df['date'] = (
            pd.to_datetime(history_df['date'], unit='s', utc=True)
            .dt.tz_localize(None)
            .dt.normalize()
        )
        columns = [
            column
            for column in ['date', 'open', 'high', 'low', 'close']
            if column in history_df.columns
        ]
        return history_df[columns].drop_duplicates(subset=['date']).sort_values('date')

    async def get_usd_brl_historical_data(
        self,
        init_date: pd.Timestamp = None,
    ) -> pd.DataFrame:
        history_df = await self.bcb_api_client.get_usd_brl_quotation(init_date=init_date)
        return history_df.rename(columns={'value': 'usd_to_brl_rate'})

    async def get_all_fiis_df(self):
        fiis_df = await self.status_invest_client.get_fiis_df()
        fiis_df['segment_id'] = fiis_df['segment'].map(
            lambda seg: STATUSINVEST_TO_INTERNAL_SEGMENT.get(seg, FII_SEGMENT.OTHERS).value
        )
        return fiis_df

    async def get_fii_dividends_df(self, tickers: list, max: bool = True):
        """Busca dividendos de FIIs em paralelo."""

        async def fetch_provents(ticker):
            try:
                return await self.status_invest_client.get_provents_df(ticker, max=max)
            except Exception:
                raise

        tasks = [fetch_provents(ticker) for ticker in tickers]
        results = await asyncio.gather(*tasks)

        provents_df = pd.concat(results, ignore_index=True) if results else pd.DataFrame()
        return provents_df

    async def fetch_quotes(
        self,
        *,
        ticker: str,
        asset_type_id: int,
        start_date: date | None = None,
        exchange: str | None = None,
    ) -> FetchedQuotes:
        """Fetch raw daily quotes without filling calendar gaps.

        This is the provider-facing contract used by on-demand reads and by
        quote ingestion. Vendor response formats stay confined to
        the handlers below.
        """
        handlers = {
            ASSET_TYPE.STOCK: self._fetch_stock_quotes,
            ASSET_TYPE.BDR: self._fetch_stock_quotes,
            ASSET_TYPE.ETF: self._fetch_etf_quotes,
            ASSET_TYPE.REIT: self._fetch_etf_quotes,
            ASSET_TYPE.FII: self._fetch_fii_quotes,
            ASSET_TYPE.CRIPTO: self._fetch_crypto_quotes,
        }
        handler = handlers.get(asset_type_id)
        if handler is None:
            raise ValidationError(
                'Unsupported asset type for quotes',
                context={'asset_type_id': asset_type_id},
            )
        return await handler(
            ticker=ticker,
            start_date=start_date,
            exchange=exchange,
        )

    async def _fetch_stock_quotes(
        self,
        *,
        ticker: str,
        start_date: date | None,
        exchange: str | None,
    ) -> FetchedQuotes:
        today = datetime.now(MARKET_TIMEZONE).date()
        parameters = {
            'symbols': ticker.upper(),
            'range': 'max' if start_date is None else None,
            'interval': '1d',
            'startDate': start_date.isoformat() if start_date else None,
            'endDate': today.isoformat() if start_date else None,
            'sortOrder': 'asc',
        }
        response = await self.brapi_client.get_stock_historical(**parameters)
        result = next(
            (
                item
                for item in response.get('results', [])
                if item.get('requestedSymbol', '').upper() == ticker.upper()
                or item.get('symbol', '').upper() == ticker.upper()
            ),
            None,
        )
        history = (result or {}).get('data', {}).get('historicalDataPrice', [])
        currency = 'BRL' if exchange in {None, EXCHANGE.B3, EXCHANGE.B3.value} else 'USD'
        return FetchedQuotes(
            ticker=ticker,
            currency=currency,
            source='brapi',
            parameters=self._without_none(parameters),
            quotes=self._normalize_quotes(history),
        )

    async def _fetch_etf_quotes(
        self,
        *,
        ticker: str,
        start_date: date | None,
        exchange: str | None,
    ) -> FetchedQuotes:
        # Kept as a distinct handler so ETF acquisition can evolve without
        # changing the service contract when a dedicated upstream feed exists.
        return await self._fetch_stock_quotes(
            ticker=ticker,
            start_date=start_date,
            exchange=exchange,
        )

    async def _fetch_fii_quotes(
        self,
        *,
        ticker: str,
        start_date: date | None,
        exchange: str | None,
    ) -> FetchedQuotes:
        del exchange
        today = datetime.now(MARKET_TIMEZONE).date()
        parameters = {
            'symbols': ticker.upper(),
            # This endpoint has no `max` range. An early lower bound asks for
            # all history that the provider can make available.
            'startDate': (start_date or date(1900, 1, 1)).isoformat(),
            'endDate': today.isoformat(),
            'sortOrder': 'asc',
        }
        response = await self.brapi_client.get_fii_historical(**parameters)
        result = next(
            (
                item
                for item in response.get('fiis', [])
                if item.get('symbol', '').upper() == ticker.upper()
            ),
            None,
        )
        history = (result or {}).get('historicalDataPrice', [])
        return FetchedQuotes(
            ticker=ticker,
            currency='BRL',
            source='brapi',
            parameters=parameters,
            quotes=self._normalize_quotes(history),
        )

    async def _fetch_crypto_quotes(
        self,
        *,
        ticker: str,
        start_date: date | None,
        exchange: str | None,
    ) -> FetchedQuotes:
        del exchange
        today = datetime.now(MARKET_TIMEZONE).date()
        range_param = self.brapi_client._brapi_range_from_init_date(start_date)
        response = await self.brapi_client.get_crypto_quotes(
            ticker,
            start_date=start_date,
            end_date=today,
            currency='USD',
            interval='1d',
        )
        return FetchedQuotes(
            ticker=ticker,
            currency=response.get('currency'),
            source='brapi',
            parameters={
                'coin': ticker.upper(),
                'currency': 'USD',
                'range': range_param,
                'interval': '1d',
            },
            quotes=[
                Quote(
                    date=pd.Timestamp(item['date']).date(),
                    open=item.get('open'),
                    high=item.get('high'),
                    low=item.get('low'),
                    close=item.get('close'),
                    volume=item.get('volume'),
                )
                for item in response.get('quotes', [])
            ],
        )

    @staticmethod
    def _normalize_quotes(history: list[dict]) -> list[Quote]:
        quotes: dict[date, Quote] = {}
        for item in history:
            if item.get('date') is None:
                continue
            quote_date = pd.to_datetime(item['date'], unit='s', utc=True).date()
            quotes[quote_date] = Quote(
                date=quote_date,
                open=item.get('open'),
                high=item.get('high'),
                low=item.get('low'),
                close=item.get('close'),
                adjusted_close=item.get('adjustedClose'),
                volume=item.get('volume'),
            )
        return [quotes[quote_date] for quote_date in sorted(quotes)]

    @staticmethod
    def _without_none(values: dict) -> dict:
        return {key: value for key, value in values.items() if value is not None}

    async def close(self):
        """Close all HTTP clients."""
        await asyncio.gather(
            self.brapi_client.aclose(),
            self.bcb_api_client.aclose(),
            self.mais_retorno_client.aclose(),
            self.crypto_compare_client.aclose(),
            self.status_invest_client.aclose(),
            self.tesouro_client.aclose(),
        )
