"""Reads of an investment fund's published profile.

An investment fund here is one that is neither a real-estate fund nor an ETF.
Both of those have readings of their own and are filtered out of the catalogue
by the kind the provider states, never by the ticker: a code ending in 11 says
nothing about which of them a fund is.
"""

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE

#: A fund refiles its share value daily at most and its portfolio quarterly, so
#: a few hours of staleness costs a reader nothing and spares the provider a
#: call on every page open. The cache fills on miss; nothing warms it. The same
#: window the real-estate profile uses, for the same reason.
INVESTMENT_FUND_PROFILE_TTL_SECONDS = 21600
INVESTMENT_FUND_MARKET_TTL_SECONDS = 21600


class InvestmentFundMarketReadService:
    """Provider catalogue enriched with ids of funds registered in the app."""

    def __init__(
        self,
        *,
        uow: UnitOfWork,
        provider: MarketDataProvider,
        cache: RedisService | None = None,
    ) -> None:
        self.uow = uow
        self.provider = provider
        self.cache = cache or RedisService()

    async def list_market(self) -> dict:
        provider_funds = await self._fetch_market()
        tickers = [fund['ticker'] for fund in provider_funds]
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(tickers, ASSET_TYPE.FI)
        asset_ids = {asset.ticker.upper(): asset.id for asset in assets if asset.ticker}

        return {
            'funds': [
                {**fund, 'asset_id': asset_ids.get(fund['ticker'])} for fund in provider_funds
            ],
            'total': len(provider_funds),
            'source': 'brapi',
        }

    @cached(
        key_prefix='investment_fund_market',
        cache=lambda self: self.cache,
        ttl=INVESTMENT_FUND_MARKET_TTL_SECONDS,
    )
    async def _fetch_market(self) -> list[dict]:
        funds = await self.provider.fetch_investment_fund_market()
        normalized: list[dict] = []
        for fund in funds:
            ticker = self._text(fund.get('symbol'))
            if not ticker:
                continue
            kind = self._text(fund.get('assetType'))
            normalized.append({
                'ticker': ticker.upper(),
                'name': self._text(fund.get('name')) or ticker.upper(),
                'cnpj': self._text(fund.get('cnpj')),
                'kind': kind.lower() if kind else None,
                'b3_classification': self._text(fund.get('b3Classification')),
                'anbima_classification': self._text(fund.get('anbimaClassification')),
                'administrator': self._text(fund.get('administratorName')),
                'manager': self._text(fund.get('managerName')),
                'price': self._number(fund.get('price')),
                'nav_per_share': self._number(fund.get('navPerShare')),
                'price_to_nav': self._number(fund.get('priceToNav')),
                'equity': self._number(fund.get('equity')),
                'total_assets': self._number(fund.get('totalAssets')),
                'investors': self._integer(fund.get('totalInvestors')),
            })
        return normalized

    @staticmethod
    def _text(value: object) -> str | None:
        text = str(value).strip() if value is not None else ''
        return text or None

    @staticmethod
    def _number(value: object) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _integer(cls, value: object) -> int | None:
        number = cls._number(value)
        return int(number) if number is not None else None

    async def aclose(self) -> None:
        await self.provider.close()


class InvestmentFundProfileReadService:
    """What an investment fund publishes about itself.

    Read-only and unpersisted: this answers a market page, and none of it feeds
    a portfolio calculation. The asset is resolved from storage first so the
    provider is only asked about tickers the application actually registers.
    """

    def __init__(
        self,
        *,
        uow: UnitOfWork,
        provider: MarketDataProvider,
        cache: RedisService | None = None,
    ) -> None:
        self.uow = uow
        self.provider = provider
        self.cache = cache or RedisService()

    async def get_profile(self, *, asset_id: int) -> dict:
        async with self.uow as uow:
            assets = await uow.assets.get_by_ids([asset_id])

        asset = next(iter(assets), None)
        if asset is None:
            raise NotFoundError('Asset not found', context={'asset_id': asset_id})
        if asset.asset_type_id != ASSET_TYPE.FI:
            raise ValidationError(
                'Asset is not an investment fund',
                context={'asset_id': asset_id, 'asset_type_id': asset.asset_type_id},
            )
        if not asset.ticker:
            raise ValidationError('Asset has no ticker', context={'asset_id': asset_id})

        return await self._fetch_profile(ticker=asset.ticker)

    @cached(
        key_prefix='investment_fund_profile',
        cache=lambda self: self.cache,
        ttl=INVESTMENT_FUND_PROFILE_TTL_SECONDS,
    )
    async def _fetch_profile(self, *, ticker: str) -> dict:
        profile = await self.provider.fetch_investment_fund_profile(ticker=ticker)
        return profile.to_dict()

    async def aclose(self) -> None:
        await self.provider.close()
