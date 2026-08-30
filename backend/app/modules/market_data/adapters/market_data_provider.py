# app/modules/market_data/service/market_data_provider.py
import asyncio
import math
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import astuple
from datetime import date, datetime
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

import pandas as pd

from app.config.logger import logger
from app.core.exceptions import ValidationError
from app.infra.integrations.b3_index_client import B3IndexClient
from app.infra.integrations.bcb_client import BCBClient
from app.infra.integrations.brapi_client import BrapiClient
from app.infra.integrations.crypto_compare_client import CryptoCompareClient
from app.infra.integrations.mais_retorno_client import MaisRetornoClient
from app.infra.integrations.status_invest_client import StatusInvestClient
from app.infra.integrations.tesouro_client import TesouroClient
from app.lib.utils.df import extend_values_to_today
from app.modules.market_data.domain.constants import ASSET_TYPE, FII_SEGMENT, SERIES
from app.modules.market_data.domain.enums import EXCHANGE
from app.modules.market_data.domain.fii import (
    FIIAllocation,
    FIIComposition,
    FIICompositionPoint,
    FIICompositionSummary,
    FIIDividend,
    FIIHolding,
    FIIIndicators,
    FIILand,
    FIIManagement,
    FIIMonthlyReport,
    FIIProfile,
    FIIPropertiesPoint,
    FIIProperty,
    FIIPropertySummary,
    FIIRight,
)
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

#: One row of a provider history, whatever shape the route answers with.
HistoryPoint = TypeVar('HistoryPoint')

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


#: Provider field behind each number of the monthly filing. Same rule as the
#: indicators above: a line the fund did not file stays None, because a fund
#: that holds no paper and one that did not say are different statements.
FII_REPORT_KEYS: dict[str, str] = {
    'admin_fee_rate': 'adminFeeRate',
    'monthly_patrimonial_return': 'monthlyPatrimonialReturn',
    'amortization_rate': 'amortizationRate',
    'equity': 'equity',
    'total_assets': 'totalAssets',
    'total_invested': 'totalInvested',
    'cash': 'cash',
    'liquidity_needs': 'liquidityNeeds',
    'government_bonds': 'governmentBonds',
    'private_bonds': 'privateBonds',
    'fixed_income_funds': 'fixedIncomeFunds',
    'real_estate': 'realEstateAssets',
    'real_estate_company_shares': 'realEstateCompanyShares',
    'real_estate_company_units': 'realEstateCompanyUnits',
    'cri': 'cri',
    'lci': 'lci',
    'fii_holdings': 'fiiHoldings',
    'receivables': 'receivables',
    'rental_receivables': 'rentalReceivables',
    'other_receivables': 'otherReceivables',
    'distributions_payable': 'distributionsPayable',
    'admin_fees_payable': 'adminFeesPayable',
    'real_estate_obligations': 'realEstateObligations',
    'total_liabilities': 'totalLiabilities',
}

#: The quarterly filing describes buildings, paper, land and rights with four
#: shapes of its own. Each is declared as which of its fields is a number, a
#: text, a date or a flag, so that one reader handles all four and a field
#: added upstream is one line here.
FII_PROPERTY_FIELDS: dict[str, dict[str, str]] = {
    'text': {
        'name': 'name',
        'identifier': 'identifier',
        'address': 'address',
        'property_class': 'propertyClass',
    },
    'number': {
        'area': 'area',
        'vacancy_rate': 'vacancyRate',
        'delinquency_rate': 'delinquencyRate',
        'revenue_share': 'revenueShare',
        'leased_rate': 'leasedRate',
        'sold_rate': 'soldRate',
        'construction_progress_actual': 'constructionProgressActual',
        'construction_progress_expected': 'constructionProgressExpected',
        'construction_cost_actual': 'constructionCostActual',
        'construction_cost_expected': 'constructionCostExpected',
        'invested_share': 'investedShare',
    },
    'integer': {'unit_count': 'unitCount'},
    'flag': {'confidential': 'confidential'},
}

FII_HOLDING_FIELDS: dict[str, dict[str, str]] = {
    'text': {
        'asset_class': 'assetClass',
        'name': 'name',
        'issuer': 'issuer',
        'issuer_cnpj': 'issuerCnpj',
        'identifier': 'identifier',
        'issue': 'issue',
        'series': 'series',
        'ticker': 'ticker',
    },
    'number': {'quantity': 'quantity', 'value': 'value'},
    'date': {'maturity_date': 'maturityDate'},
    'flag': {'confidential': 'confidential'},
}

FII_LAND_FIELDS: dict[str, dict[str, str]] = {
    'text': {'name': 'name', 'identifier': 'identifier', 'address': 'address'},
    'number': {
        'area': 'area',
        'invested_share': 'investedShare',
        'equity_share': 'equityShare',
    },
    'flag': {'confidential': 'confidential'},
}

FII_RIGHT_FIELDS: dict[str, dict[str, str]] = {
    'text': {'name': 'name', 'identifier': 'identifier', 'description': 'description'},
    'number': {'value': 'value'},
    'flag': {'confidential': 'confidential'},
}

#: Quantos fundos são consultados ao mesmo tempo. O mesmo teto que a
#: ingestão de cotações usa: a cota do provedor é por minuto, não por rota.
MAX_CONCURRENT_FII_REQUESTS = 5

#: Quantos informes mensais são pedidos para achar o mais recente. O provedor
#: aceita ordenação, mas não publica por qual campo, então a página lê uma
#: janela e escolhe a maior data ela mesma.
FII_REPORT_WINDOW = 24


class MarketDataProvider:
    quote_source = 'brapi'

    def __init__(self):
        self.brapi_client = BrapiClient()
        self.b3_index_client = B3IndexClient()
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

        if series.id in {SERIES.CDI, SERIES.IPCA}:
            history_df = await self.bcb_api_client.get_market_index_history_df(
                series.symbol, init_date=init_date
            )
            history_df.rename(columns={'value': 'close'}, inplace=True)

        elif series.id == SERIES.IFIX:
            history_df = await self._fetch_b3_index_history(
                'IFIX',
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
        if series.id in {SERIES.CDI, SERIES.IPCA}:
            return 'bcb'
        if series.id == SERIES.IFIX:
            return 'b3'
        return 'brapi'

    async def _fetch_b3_index_history(
        self,
        index: str,
        *,
        init_date: pd.Timestamp | date | None,
    ) -> pd.DataFrame:
        """Read B3's official year tables and turn the month matrix into dates.

        BRAPI currently returns only the latest IFIX point even when a range is
        requested. B3 publishes the complete daily evolution split by year;
        asking from ``init_date`` also repairs a missed ingestion window.
        """
        today = datetime.now(MARKET_TIMEZONE).date()
        first_year = pd.Timestamp(init_date).year if init_date else 2010
        responses = await asyncio.gather(
            *(
                self.b3_index_client.get_daily_evolution(index=index, year=year)
                for year in range(first_year, today.year + 1)
            )
        )

        points: list[dict] = []
        for year, response in zip(range(first_year, today.year + 1), responses, strict=True):
            for row in response.get('results', []):
                day = row.get('day')
                if not isinstance(day, int):
                    continue
                for month in range(1, 13):
                    close = self._b3_number(row.get(f'rateValue{month}'))
                    if close is None:
                        continue
                    try:
                        point_date = date(year, month, day)
                    except ValueError:
                        continue
                    if point_date > today or (
                        init_date and point_date < pd.Timestamp(init_date).date()
                    ):
                        continue
                    points.append({'date': pd.Timestamp(point_date), 'close': close})

        if not points:
            return pd.DataFrame(columns=['date', 'close'])
        return (
            pd.DataFrame(points)
            .drop_duplicates(subset=['date'])
            .sort_values('date')
            .reset_index(drop=True)
        )

    @staticmethod
    def _b3_number(value: object) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        if isinstance(value, int | float):
            return float(value)
        text = str(value).strip()
        if not text:
            return None
        try:
            return float(text.replace('.', '').replace(',', '.'))
        except ValueError:
            return None

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

    async def fetch_fii_dividends(self, tickers: Sequence[str]) -> dict[str, list[FIIDividend]]:
        """The payments each fund made, from `GET /v2/fii/dividends`.

        Same route and same mapping the market page reads, so a payment is the
        same fact on both sides -- amount per share as published, and the
        provider's own label, which is the only thing separating income from an
        amortization of capital.

        One request per fund rather than one batched call: the route is asked
        for a single symbol everywhere else here, and a fund the provider has
        never recorded a payment for answers empty rather than failing the
        others.
        """
        symbols = list(dict.fromkeys(ticker.strip().upper() for ticker in tickers if ticker))
        if not symbols:
            return {}

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_FII_REQUESTS)

        async def fetch(symbol: str) -> tuple[str, list[FIIDividend]]:
            async with semaphore:
                try:
                    # Ascending, so a caller reading the last payment does not
                    # have to sort first.
                    response = await self.brapi_client.get_fii_dividends(
                        symbols=symbol, sortOrder='asc'
                    )
                except Exception as exc:
                    logger.warning('Could not read the dividends of %s: %s', symbol, exc)
                    return symbol, []
                return symbol, self._fii_dividends(response, symbol)

        return dict(await asyncio.gather(*(fetch(symbol) for symbol in symbols)))

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
        """Everything the provider publishes about one real-estate fund.

        Seven routes answer for one page, and each is read on its own: the
        indicators and the monthly filing are monthly, the payments follow the
        fund's own calendar, and the composition of what it holds is filed
        quarterly and published months later. A fund the provider has never
        described still has a payment history worth charting, so one route
        failing costs the page that section and nothing else.

        Every route failing is not a profile at all and raises. An expired
        token or a spent quota refuses all seven at once, and that has to reach
        the reader as itself rather than as a page of empty cards.

        The fan-out is bounded by the same limit the dividend ingestion uses,
        for the same reason: the provider counts its quota per minute, not per
        route.
        """
        symbol = ticker.upper()
        requests = {
            'indicators': lambda: self.brapi_client.get_fii_indicators(symbols=symbol),
            # Ascending, so every series arrives in the order it is charted in.
            'indicators_history': lambda: self.brapi_client.get_fii_indicators_history(
                symbols=symbol, sortOrder='asc'
            ),
            'dividends': lambda: self.brapi_client.get_fii_dividends(
                symbols=symbol, sortOrder='asc'
            ),
            'reports': lambda: self.brapi_client.get_fii_reports(
                symbols=symbol, sortOrder='desc', limit=FII_REPORT_WINDOW
            ),
            # Without a reference date, both quarterly routes answer with the
            # most recent quarter the fund has filed.
            'composition': lambda: self.brapi_client.get_fii_portfolio(symbols=symbol),
            'composition_history': lambda: self.brapi_client.get_fii_portfolio_history(
                symbols=symbol, sortOrder='asc'
            ),
            'properties_history': lambda: self.brapi_client.get_fii_properties_history(
                symbols=symbol, sortOrder='asc'
            ),
        }
        responses = await self._gather_fii_routes(requests)

        failures = [item for item in responses.values() if isinstance(item, BaseException)]
        if len(failures) == len(responses):
            raise failures[0]

        indicators = self._fii_result(responses['indicators'], symbol, subject='indicators')
        composition = self._fii_result(responses['composition'], symbol, subject='composition')
        return FIIProfile(
            ticker=symbol,
            management=self._fii_management(indicators),
            indicators=self._fii_indicators(indicators),
            indicators_history=self._fii_history(
                responses['indicators_history'],
                symbol,
                subject='indicators history',
                build=lambda _, item: self._indicators(item, date_key='referenceDate'),
            ),
            dividends=self._fii_dividends(responses['dividends'], symbol),
            monthly_report=self._fii_monthly_report(responses['reports'], symbol),
            composition=self._fii_composition(composition),
            composition_history=self._fii_history(
                responses['composition_history'],
                symbol,
                subject='composition history',
                build=lambda moment, item: FIICompositionPoint(
                    reference_date=moment,
                    summary=self._composition_summary(item.get('summary')),
                    allocations=self._allocations(item.get('allocations')),
                ),
            ),
            properties_history=self._fii_history(
                responses['properties_history'],
                symbol,
                subject='properties history',
                build=lambda moment, item: FIIPropertiesPoint(
                    reference_date=moment,
                    summary=self._property_summary(item.get('summary')),
                ),
            ),
        )

    @staticmethod
    async def _gather_fii_routes(
        requests: dict[str, Callable[[], Awaitable[Any]]],
    ) -> dict[str, Any]:
        """Every route of one profile, answered or failed, under its own name.

        A failure is returned rather than raised so that the caller decides
        what a missing section costs, which is what reading the sections
        independently means.
        """
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_FII_REQUESTS)

        async def call(request: Callable[[], Awaitable[Any]]) -> Any:
            async with semaphore:
                try:
                    return await request()
                except Exception as exc:
                    return exc

        answers = await asyncio.gather(*(call(request) for request in requests.values()))
        return dict(zip(requests, answers, strict=True))

    async def fetch_fii_market(self) -> list[dict]:
        """The complete summarized FII catalogue exposed by BRAPI.

        The listing route is intentionally used once for the universe instead
        of fanning out indicator requests in batches of twenty.
        """
        response = await self.brapi_client.list_fiis(
            page=1,
            limit=10000,
            sortBy='symbol',
            sortOrder='asc',
        )
        return response.get('fiis', [])

    async def fetch_market_catalogue(self, kind: str) -> list[dict]:
        """A current, comparable snapshot of one exchange-traded universe.

        B3 instruments have a paginated screener endpoint. Crypto has a
        separate symbol dictionary and quote endpoint, so its universe is
        quoted in bounded batches and then returned as the same flat list.
        """
        if kind in {'stock', 'etf'}:
            filters = {'type': 'stock'} if kind == 'stock' else {'subType': 'etf'}
            response = await self.brapi_client.list_stocks(
                page=1,
                limit=10000,
                sortBy='volume',
                sortOrder='desc',
                **filters,
            )
            return response.get('stocks', [])

        if kind != 'crypto':
            raise ValidationError('Unsupported market catalogue', context={'kind': kind})

        available = await self.brapi_client.get_crypto_available()
        symbols = [str(symbol).upper() for symbol in available.get('coins', []) if symbol]
        batches = [symbols[index : index + 50] for index in range(0, len(symbols), 50)]
        responses = await asyncio.gather(
            *(
                self.brapi_client.get_crypto(
                    coin=','.join(batch),
                    currency='BRL',
                    range='1d',
                    interval='1d',
                )
                for batch in batches
            ),
            return_exceptions=True,
        )

        quoted: dict[str, dict] = {}
        for response in responses:
            if isinstance(response, BaseException):
                logger.warning('Could not read a BRAPI crypto market batch: %s', response)
                continue
            for coin in response.get('coins', []):
                symbol = str(coin.get('coin', '')).upper()
                if symbol:
                    quoted[symbol] = coin

        # A transient failure in one quote batch should cost those rows their
        # current numbers, not remove supported symbols from the catalogue.
        return [quoted.get(symbol, {'coin': symbol, 'coinName': symbol}) for symbol in symbols]

    def _fii_result(self, response: object, symbol: str, *, subject: str) -> dict | None:
        """The one fund's entry in a route that answers under `fiis`."""
        payload = self._fii_payload(response, symbol, key='fiis', subject=subject)
        return next((item for item in payload if self._is_symbol(item, symbol)), None)

    def _fii_history(
        self,
        response: object,
        symbol: str,
        *,
        subject: str,
        build: Callable[[date, dict], HistoryPoint],
    ) -> list[HistoryPoint]:
        """One row per reference date, oldest first.

        The three history routes answer the same way -- a flat list under
        `history`, each row naming its fund and dated by `referenceDate` --
        and only what is read out of a row differs. The order is imposed here
        rather than trusted: the routes accept a sort direction but do not
        publish which field they sort by, and a month filed twice after a
        correction must not be charted twice.
        """
        payload = self._fii_payload(response, symbol, key='history', subject=subject)

        points: dict[date, HistoryPoint] = {}
        for item in payload:
            if not self._is_symbol(item, symbol):
                continue
            moment = self._provider_date(item.get('referenceDate'))
            if moment is None:
                continue
            points[moment] = build(moment, item)
        return [points[moment] for moment in sorted(points)]

    def _fii_indicators(self, result: dict | None) -> FIIIndicators | None:
        """The fund's current numbers, from `GET /v2/fii/indicators`."""
        return self._indicators(result, date_key='asOfDate') if result is not None else None

    def _indicators(self, result: dict, *, date_key: str) -> FIIIndicators:
        """The indicators of one entry, current or historical.

        The two routes publish the same numbers under the same names and date
        the entry differently -- `asOfDate` for the current one, `referenceDate`
        for a month of the history -- so the date is the only thing the caller
        has to say.
        """
        shareholders = self._number(result.get('totalInvestors'))
        return FIIIndicators(
            as_of_date=self._provider_date(result.get(date_key)),
            segment_type=self._text(result.get('segmentType')),
            # Absent from the provider's documented example but present in what
            # it actually answers, under either spelling.
            segment=self._text(result.get('segmentoAtuacao') or result.get('segment')),
            shareholders=int(shareholders) if shareholders is not None else None,
            **{name: self._number(result.get(key)) for name, key in FII_INDICATOR_KEYS.items()},
        )

    def _fii_management(self, result: dict | None) -> FIIManagement | None:
        """Who runs the fund, published beside its indicators.

        A fund the provider knows nothing about beyond its ticker has no
        management to show, and an object of five empty fields would still
        draw the section. So nothing at all reads as nothing.
        """
        if result is None:
            return None

        management = FIIManagement(
            cnpj=self._text(result.get('cnpj')),
            mandate=self._text(result.get('mandate')),
            management_type=self._text(result.get('tipoGestao')),
            administrator_name=self._text(result.get('administratorName')),
            administrator_website=self._text(result.get('administratorWebsite')),
        )
        return management if any(astuple(management)) else None

    def _fii_monthly_report(self, response: object, symbol: str) -> FIIMonthlyReport | None:
        """The most recent monthly filing in the window that was asked for.

        The route sorts, but does not publish which field it sorts by, so the
        newest filing is the one with the highest reference date and not the
        one that came first.
        """
        payload = self._fii_payload(response, symbol, key='reports', subject='monthly reports')

        reports: dict[date, FIIMonthlyReport] = {}
        for item in payload:
            if not self._is_symbol(item, symbol):
                continue
            filed_on = self._provider_date(item.get('referenceDate'))
            if filed_on is None:
                continue
            reports[filed_on] = FIIMonthlyReport(
                reference_date=filed_on,
                **{name: self._number(item.get(key)) for name, key in FII_REPORT_KEYS.items()},
            )
        return reports[max(reports)] if reports else None

    def _fii_composition(self, result: dict | None) -> FIIComposition | None:
        """One quarter of what the fund holds, item by item.

        The buildings arrive in this same answer, which is why the properties
        route is not asked for as well: it is this list, sorted upstream.
        """
        if result is None:
            return None

        return FIIComposition(
            reference_date=self._provider_date(result.get('referenceDate')),
            summary=self._composition_summary(result.get('summary')),
            allocations=self._allocations(result.get('allocations')),
            properties=[
                FIIProperty(**self._mapped(item, FII_PROPERTY_FIELDS))
                for item in self._items(result.get('properties'))
            ],
            financial_assets=[
                FIIHolding(**self._mapped(item, FII_HOLDING_FIELDS))
                for item in self._items(result.get('financialAssets'))
            ],
            fund_holdings=[
                FIIHolding(**self._mapped(item, FII_HOLDING_FIELDS))
                for item in self._items(result.get('fundHoldings'))
            ],
            lands=[
                FIILand(**self._mapped(item, FII_LAND_FIELDS))
                for item in self._items(result.get('lands'))
            ],
            rights=[
                FIIRight(**self._mapped(item, FII_RIGHT_FIELDS))
                for item in self._items(result.get('rights'))
            ],
        )

    def _composition_summary(self, value: object) -> FIICompositionSummary | None:
        if not isinstance(value, dict):
            return None

        groups = {
            name: group if isinstance(group := value.get(name), dict) else {}
            for name in ('financialAssets', 'lands', 'rights')
        }
        return FIICompositionSummary(
            total_items=self._integer(value.get('totalItems')),
            declared_value=self._number(value.get('declaredValue')),
            properties=self._property_summary(value.get('properties')),
            financial_assets_count=self._integer(groups['financialAssets'].get('count')),
            financial_assets_value=self._number(groups['financialAssets'].get('declaredValue')),
            lands_count=self._integer(groups['lands'].get('count')),
            lands_area=self._number(groups['lands'].get('totalArea')),
            rights_count=self._integer(groups['rights'].get('count')),
            rights_value=self._number(groups['rights'].get('declaredValue')),
        )

    def _property_summary(self, value: object) -> FIIPropertySummary | None:
        """The buildings added up.

        It arrives nested under the composition's summary and on its own in the
        buildings history, in the same shape both times.
        """
        if not isinstance(value, dict):
            return None

        return FIIPropertySummary(
            count=self._integer(value.get('count')),
            total_area=self._number(value.get('totalArea')),
            vacancy_rate=self._number(value.get('vacancyRate')),
            average_vacancy_rate=self._number(value.get('averageVacancyRate')),
            properties_with_vacancy=self._integer(value.get('propertiesWithVacancy')),
        )

    def _allocations(self, value: object) -> list[FIIAllocation]:
        """How much of each asset class, in the quarter.

        An entry without a class says nothing that can be charted or labelled,
        so it is dropped rather than carried as an unnamed slice.
        """
        return [
            FIIAllocation(
                asset_class=asset_class,
                count=self._integer(item.get('count')),
                value=self._number(item.get('value')),
            )
            for item in self._items(value)
            if (asset_class := self._text(item.get('assetClass')))
        ]

    def _mapped(self, item: dict, spec: dict[str, dict[str, str]]) -> dict[str, Any]:
        """One item of the quarterly filing, read field by field as declared."""
        readers: dict[str, Callable[[object], Any]] = {
            'text': self._text,
            'number': self._number,
            'integer': self._integer,
            'date': self._provider_date,
            'flag': self._flag,
        }
        return {
            name: readers[kind](item.get(key))
            for kind, keys in spec.items()
            for name, key in keys.items()
        }

    @staticmethod
    def _items(value: object) -> list[dict]:
        """The objects of a list the provider may answer with, or none."""
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

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

    @classmethod
    def _integer(cls, value: object) -> int | None:
        """A whole count. Providers write counts as numbers all the same."""
        number = cls._number(value)
        return int(number) if number is not None else None

    @staticmethod
    def _flag(value: object) -> bool | None:
        """A published yes or no. Anything else is unpublished, not a no."""
        return value if isinstance(value, bool) else None

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
            if isinstance(value, int | float):
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
            self.b3_index_client.aclose(),
            self.bcb_api_client.aclose(),
            self.mais_retorno_client.aclose(),
            self.crypto_compare_client.aclose(),
            self.status_invest_client.aclose(),
            self.tesouro_client.aclose(),
        )
