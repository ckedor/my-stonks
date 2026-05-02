# app/modules/market_data/service/market_data_provider.py
import asyncio
from typing import Callable

import pandas as pd
from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.models.constants.asset_type import ASSET_TYPE
from app.infra.db.models.constants.fii_segments import FIISegment
from app.infra.db.models.constants.index import INDEX
from app.infra.db.models.market_data import Index
from app.infra.integrations.alpha_vantage_client import AlphaVantageClient
from app.infra.integrations.bcb_client import BCBClient
from app.infra.integrations.brapi_client import BrapiClient
from app.infra.integrations.crypto_compare_client import CryptoCompareClient
from app.infra.integrations.mais_retorno_client import MaisRetornoClient
from app.infra.integrations.status_invest_client import StatusInvestClient
from app.infra.integrations.tesouro_client import TesouroClient
from app.lib.utils.strings import extract_digits
from app.modules.market_data.domain.enums import EXCHANGE, AssetType

STATUSINVEST_TO_INTERNAL_SEGMENT = {
    'Shoppings': FIISegment.SHOPPING,
    'Papéis': FIISegment.RECEIVABLES,
    'Lajes Corporativas': FIISegment.CORPORATE,
    'Fundo de Fundos': FIISegment.FOF,
    'Misto': FIISegment.HYBRID,
    'Imóveis Residenciais': FIISegment.RESIDENTIAL,
    'Imóveis Industriais e Logísticos': FIISegment.LOGISTICS,
    'Indefinido': FIISegment.OTHERS,
    'Imóveis Comerciais - Outros': FIISegment.HYBRID,
    'Serviços Financeiros Diversos': FIISegment.RECEIVABLES,
    'Agências de Bancos': FIISegment.BANK_AGENCIES,
    'Hotéis': FIISegment.HOTELS,
    'Fundo de Desenvolvimento': FIISegment.DEVELOPMENT,
    'Incorporações': FIISegment.INCORPORATIONS,
    'Varejo': FIISegment.RETAIL,
    'Outros': FIISegment.OTHERS,
    'Educacional': FIISegment.EDUCATIONAL,
    'Logística': FIISegment.LOGISTICS,
    'Hospitalar': FIISegment.HOSPITAL,
    'Exploração de Imóveis': FIISegment.HYBRID,
    'Tecidos. Vestuário e Calçados': FIISegment.SHOPPING,
}


class MarketDataProvider:
    def __init__(self):
        self.brapi_client = BrapiClient()
        self.bcb_api_client = BCBClient()
        self.alphavantage_client = AlphaVantageClient()
        self.mais_retorno_client = MaisRetornoClient()
        self.crypto_compare_client = CryptoCompareClient()
        self.status_invest_client = StatusInvestClient()
        self.tesouro_client = TesouroClient()

    async def get_series_historical_data(
        self, index: Index, init_date: pd.Timestamp = None
    ) -> pd.DataFrame:
        """
        Use: get asset prices and market indexes
        """
        history_df = None

        if index.id == INDEX.USDBRL:
            history_df = await self.bcb_api_client.get_usd_brl_quotation(init_date=init_date)
            history_df.rename(columns={'value': 'close'}, inplace=True)

        elif index.id in {INDEX.CDI, INDEX.IPCA}:
            history_df = await self.bcb_api_client.get_market_index_history_df(
                index.symbol, init_date=init_date
            )
            history_df.rename(columns={'value': 'close'}, inplace=True)

        elif index.id == INDEX.IFIX:
            history_df = await self.alphavantage_client.get_price_history_df(index.symbol)

        else:
            history_df = await self.brapi_client.get_price_history_df(
                index.symbol, init_date=init_date, interval='1d'
            )

        return history_df

    async def get_all_fiis_df(self):
        fiis_df = await self.status_invest_client.get_fiis_df()
        fiis_df['segment_id'] = fiis_df['segment'].map(
            lambda seg: STATUSINVEST_TO_INTERNAL_SEGMENT.get(seg, FIISegment.OTHERS).value
        )
        return fiis_df

    async def get_fii_dividends_df(self, tickers: list, max: bool = True):
        """Busca dividendos de FIIs em paralelo."""
        async def fetch_provents(ticker):
            try:
                return await self.status_invest_client.get_provents_df(ticker, max=max)
            except Exception as e:
                raise

        tasks = [fetch_provents(ticker) for ticker in tickers]
        results = await asyncio.gather(*tasks)
        
        provents_df = pd.concat(results, ignore_index=True) if results else pd.DataFrame()
        return provents_df

    async def get_asset_quotes(
        self,
        ticker: str,
        asset_type: str | int | None = None,
        exchange: str | None = None,
        date: str = None,
        start_date: str = None,
        end_date: str = None,
        treasury_maturity_date: str = None,
        treasury_type: str = None,
    ) -> dict:
        """``asset_type`` accepts either the ``AssetType`` StrEnum value
        (``'STOCK'``, ``'CRIPTO'``, ...) or the ``ASSET_TYPE`` IntEnum id
        from the database. Strings are normalized to the IntEnum id before
        dispatch.
        """
        if date:
            start_date = end_date = pd.to_datetime(date)

        asset_type_id = self._coerce_asset_type_id(asset_type)

        handlers = {
            ASSET_TYPE.STOCK: self._get_quotes_stock,
            ASSET_TYPE.ETF: self._get_quotes_stock,
            ASSET_TYPE.FII: self._get_quotes_stock,
            ASSET_TYPE.BDR: self._get_quotes_stock,
            ASSET_TYPE.CRIPTO: self._get_quotes_crypto,
            ASSET_TYPE.PREV: self._get_quotes_prev,
            ASSET_TYPE.TREASURY: self._get_quotes_treasury,
        }
        handler = handlers.get(asset_type_id)
        if not handler:
            raise ValidationError("Unsupported asset type", context={"asset_type": asset_type})

        quotes = await handler(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            exchange=exchange,
            treasury_maturity_date=treasury_maturity_date,
            treasury_type=treasury_type,
        )

        return {
            'ticker': ticker,
            'asset_type': AssetType(ASSET_TYPE(asset_type_id).name).value,
            'currency': quotes.get('currency'),
            'quotes': quotes.get('quotes', []),
        }

    @staticmethod
    def _coerce_asset_type_id(asset_type) -> int | None:
        if asset_type is None:
            return None
        if isinstance(asset_type, int) and not isinstance(asset_type, bool):
            return int(asset_type)
        # String path: accept AssetType StrEnum value (e.g. 'STOCK', 'CRIPTO').
        try:
            return int(ASSET_TYPE[AssetType(asset_type).name])
        except (KeyError, ValueError):
            return None

    async def _get_quotes_stock(self, ticker: str, start_date: pd.Timestamp, end_date: pd.Timestamp, exchange=None, **_):
        return await self._get_quotes_with_fallback([
            lambda: self.brapi_client.get_quotes(ticker, start_date, end_date, interval='1d'),
            lambda: self.alphavantage_client.get_quotes(ticker, init_date=start_date, end_date=end_date, is_b3=(exchange == EXCHANGE.B3)),
        ])
    
    async def _get_quotes_with_fallback(self, providers: list[Callable]) -> dict:
        for provider in providers:
            quotes = await provider()
            if quotes.get('quotes'):
                return quotes
        raise NotFoundError("No quotes found in any provider: " + ", ".join([p.__name__ for p in providers]))

    async def _get_quotes_crypto(self, ticker: str, start_date: pd.Timestamp, end_date: pd.Timestamp, **_):
        return await self.crypto_compare_client.get_quotes(
            ticker,
            start_date=start_date,
            end_date=end_date,
        )
    
    async def _get_quotes_prev(self, ticker: str, start_date: pd.Timestamp, **_):
        return await self.mais_retorno_client.get_quotes(
            extract_digits(ticker),
            start_date=start_date,
        )
    
    async def _get_quotes_treasury(self, treasury_type: str, treasury_maturity_date: str, start_date: pd.Timestamp, end_date: pd.Timestamp, **_):
        if not treasury_type or not treasury_maturity_date:
            raise ValidationError("Treasury type and maturity date are required for treasury quotes")
        return await self.tesouro_client.get_quotes(
            treasury_type,
            treasury_maturity_date,
            start_date=start_date,
            end_date=end_date,
        )

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