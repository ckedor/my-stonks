# app/modules/market_data/service/market_data_provider.py
import asyncio
import math
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pandas as pd

from app.config.logger import logger
from app.core.exceptions import ValidationError
from app.lib.utils.df import extend_values_to_today
from app.modules.market_data.domain.constants import ASSET_TYPE, FII_SEGMENT, INDEX
from app.infra.integrations.bcb_client import BCBClient
from app.infra.integrations.brapi_client import BrapiClient
from app.infra.integrations.crypto_compare_client import CryptoCompareClient
from app.infra.integrations.mais_retorno_client import MaisRetornoClient
from app.infra.integrations.status_invest_client import StatusInvestClient
from app.infra.integrations.tesouro_client import TesouroClient
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.fii import FIIDividend, FIIIndicators, FIIProfile
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

#: Served by brapi for assets it has no artwork for; it is the vendor's own
#: mark, not the asset's.
PROVIDER_PLACEHOLDER_LOGO = 'icons/BRAPI.svg'

#: Provider field behind each numeric indicator. An indicator the provider does
#: not publish for a fund stays None and the reader renders the gap -- never a
#: zero, which would read as a fund whose equity or yield is actually nil.
FII_INDICATOR_KEYS: dict[str, str] = {
    'price': 'price',
    'nav_per_share': 'navPerShare',
    'price_to_nav': 'priceToNav',
    'dividend_yield_12m': 'dividendYield12m',
    'dividend_yield_1m': 'dividendYield1m',
    'monthly_return': 'monthlyReturn',
    'equity': 'equity',
    'total_assets': 'totalAssets',
    'shares_outstanding': 'sharesOutstanding',
}


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
            history_df = await self._fetch_market_index_history(
                series.symbol,
                init_date=init_date,
            )
            # These series have always been stored with non-trading days filled
            # in from the previous close. Kept so migrating off the provider's
            # v1 route changes the transport and nothing else.
            history_df = extend_values_to_today(history_df)

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
        return history_df.rename(columns={'value': 'usd_brl'})

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
        currency, logo_url = await self._fetch_quote_metadata(ticker, exchange=exchange)
        return FetchedQuotes(
            ticker=ticker,
            currency=currency,
            source='brapi',
            parameters=self._without_none(parameters),
            quotes=self._normalize_quotes(history),
            logo_url=logo_url,
        )

    async def _fetch_quote_metadata(
        self,
        ticker: str,
        *,
        exchange: str | None,
    ) -> tuple[str, str | None]:
        """The currency the provider prices this ticker in, and its logo.

        The historical endpoint carries neither, so ask the quote endpoint,
        which has both. Only if the provider stays silent do we fall back to
        guessing the currency from the registered exchange -- a guess that reads
        a missing exchange as Brazilian, which is how foreign ETFs ended up
        priced in BRL.
        """
        fallback = 'BRL' if exchange in {None, EXCHANGE.B3, EXCHANGE.B3.value} else 'USD'
        try:
            response = await self.brapi_client.get_stock_quotes(symbols=ticker.upper())
            for item in response.get('results', []):
                data = item.get('data') or item
                currency = data.get('currency')
                if currency:
                    return currency.upper(), self._usable_logo(
                        data.get('logourl') or data.get('logoUrl')
                    )
        except Exception as exc:
            logger.warning('Could not read the metadata of %s from the provider: %s', ticker, exc)
        return fallback, None

    async def fetch_asset_logo(self, ticker: str, asset_type_id: int) -> str | None:
        """Brand image for a ticker, independent of its quote history."""
        if asset_type_id == ASSET_TYPE.CRIPTO:
            return await self._fetch_crypto_logo(ticker)
        _, logo_url = await self._fetch_quote_metadata(ticker, exchange=None)
        return logo_url

    async def _fetch_crypto_logo(self, ticker: str) -> str | None:
        """Coin artwork, which the history provider does not carry."""
        try:
            response = await self.brapi_client.get_crypto(coin=ticker.upper(), currency='USD')
            for coin in response.get('coins', []):
                if coin.get('coin', '').upper() == ticker.upper():
                    return self._usable_logo(coin.get('coinImageUrl'))
        except Exception as exc:
            logger.warning('Could not read the logo of %s from the provider: %s', ticker, exc)
        return None

    @staticmethod
    def _usable_logo(logo_url: str | None) -> str | None:
        """Drop the provider's own placeholder, served for assets it has no
        artwork for. Showing it would brand every fund with the vendor's logo."""
        if not logo_url or PROVIDER_PLACEHOLDER_LOGO in logo_url:
            return None
        return logo_url

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

    async def fetch_fii_profile(self, *, ticker: str) -> FIIProfile:
        """A real-estate fund's published indicators and the payments it made.

        The two come from separate upstream routes and are asked for together,
        tolerating one of them failing: a fund whose indicators are missing
        still has a payment history worth charting, and the reverse holds for a
        fund the provider has never recorded a payment for. Both failing is not
        a profile at all, so that raises rather than serving an empty one --
        an expired token or a rate limit must reach the reader as itself.
        """
        symbol = ticker.upper()
        indicators_response, dividends_response = await asyncio.gather(
            self.brapi_client.get_fii_indicators(symbols=symbol),
            # Ascending, so the series arrives in the order it is charted in.
            self.brapi_client.get_fii_dividends(symbols=symbol, sortOrder='asc'),
            return_exceptions=True,
        )
        if isinstance(indicators_response, BaseException) and isinstance(
            dividends_response, BaseException
        ):
            raise indicators_response

        return FIIProfile(
            ticker=symbol,
            indicators=self._fii_indicators(indicators_response, symbol),
            dividends=self._fii_dividends(dividends_response, symbol),
        )

    def _fii_indicators(self, response: object, symbol: str) -> FIIIndicators | None:
        """The one fund's entry from `GET /v2/fii/indicators`, under `fiis`."""
        payload = self._fii_payload(response, symbol, key='fiis', subject='indicators')
        result = next((item for item in payload if self._is_symbol(item, symbol)), None)
        if result is None:
            return None

        shareholders = self._number(result.get('totalInvestors'))
        return FIIIndicators(
            as_of_date=self._provider_date(result.get('asOfDate')),
            segment_type=self._text(result.get('segmentType')),
            # Absent from the provider's documented example but present in what
            # it actually answers, under either spelling.
            segment=self._text(result.get('segmentoAtuacao') or result.get('segment')),
            shareholders=int(shareholders) if shareholders is not None else None,
            **{
                name: self._number(result.get(key))
                for name, key in FII_INDICATOR_KEYS.items()
            },
        )

    def _fii_dividends(self, response: object, symbol: str) -> list[FIIDividend]:
        """Payments from `GET /v2/fii/dividends`, a flat list under `dividends`.

        Each entry names its own fund, so the list is filtered rather than
        assumed to hold one. `rate` is the amount paid per share and is taken
        as published -- never derived from a yield.
        """
        payload = self._fii_payload(response, symbol, key='dividends', subject='dividends')

        dividends: dict[date, FIIDividend] = {}
        for payment in payload:
            if not self._is_symbol(payment, symbol):
                continue
            paid_on = self._provider_date(payment.get('paymentDate'))
            value = self._number(payment.get('rate'))
            if paid_on is None or value is None:
                continue
            dividends[paid_on] = FIIDividend(
                payment_date=paid_on,
                value_per_share=value,
                ex_date=self._provider_date(payment.get('lastDatePrior')),
                event_type=self._text(payment.get('label')),
            )
        return [dividends[paid_on] for paid_on in sorted(dividends)]

    @staticmethod
    def _fii_payload(response: object, symbol: str, *, key: str, subject: str) -> list[dict]:
        """The list a FII route answers with, or an empty one.

        A failed request arrives here as the exception `asyncio.gather`
        collected. It is logged and read as an empty half of the profile; the
        caller has already decided that one half surviving is enough.
        """
        if isinstance(response, BaseException):
            logger.warning('Could not read the %s of %s: %s', subject, symbol, response)
            return []
        if not isinstance(response, dict):
            return []
        items = response.get(key)
        return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []

    @staticmethod
    def _is_symbol(item: dict, symbol: str) -> bool:
        return str(item.get('symbol', '')).upper() == symbol

    @staticmethod
    def _number(value: object) -> float | None:
        """A finite float, or nothing. Providers write absences several ways."""
        if value is None or isinstance(value, bool):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if math.isfinite(number) else None

    @staticmethod
    def _text(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        stripped = value.strip()
        return stripped or None

    @staticmethod
    def _provider_date(value: object) -> date | None:
        """A calendar date out of whatever the provider wrote it as.

        The FII routes date their fields with ISO strings while the quote
        routes use epoch seconds, and both go through here.
        """
        if value is None or isinstance(value, bool):
            return None
        try:
            if isinstance(value, (int, float)):
                return pd.to_datetime(value, unit='s', utc=True).date()
            return pd.to_datetime(value, utc=True).date()
        except (ValueError, TypeError, pd.errors.ParserError):
            return None

    async def _fetch_crypto_quotes(
        self,
        *,
        ticker: str,
        start_date: date | None,
        exchange: str | None,
    ) -> FetchedQuotes:
        del exchange
        logo_url = await self._fetch_crypto_logo(ticker)
        # CryptoCompare goes back years further, so it is asked first. Its free
        # tier is metered, though, so a refusal falls through to brapi rather
        # than leaving the caller with nothing.
        try:
            history_df = await self.crypto_compare_client.get_crypto_quotes_df(
                ticker,
                init_date=pd.Timestamp(start_date).to_pydatetime() if start_date else None,
            )
            return FetchedQuotes(
                ticker=ticker,
                currency='USD',
                source='cryptocompare',
                logo_url=logo_url,
                parameters={
                    'instrument': f'{ticker.upper()}-USD',
                    'currency': 'USD',
                    'start_date': start_date.isoformat() if start_date else None,
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
                    for item in history_df.to_dict(orient='records')
                ],
            )
        except Exception as exc:
            logger.warning(
                'CryptoCompare unavailable for %s (%s); falling back to brapi, '
                'which caps history at 1000 daily points',
                ticker,
                exc,
            )

        response = await self.brapi_client.get_crypto_quotes(
            ticker,
            start_date=start_date,
            currency='USD',
            interval='1d',
        )
        return FetchedQuotes(
            ticker=ticker,
            currency=response.get('currency') or 'USD',
            source='brapi',
            logo_url=logo_url,
            parameters={'coin': ticker.upper(), 'currency': 'USD', 'interval': '1d'},
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
