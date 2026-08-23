"""Reads of a real-estate fund's published profile."""

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE

#: A fund republishes its indicators once a month and pays once a month, so a
#: few hours of staleness costs a reader nothing and spares the provider a call
#: on every page open. The cache fills on miss; nothing warms it.
FII_PROFILE_TTL_SECONDS = 21600
FII_MARKET_TTL_SECONDS = 21600


class FIIMarketReadService:
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
            assets = await uow.assets.get_by_tickers(tickers, ASSET_TYPE.FII)
        asset_ids = {asset.ticker.upper(): asset.id for asset in assets if asset.ticker}

        return {
            'funds': [
                {**fund, 'asset_id': asset_ids.get(fund['ticker'])} for fund in provider_funds
            ],
            'total': len(provider_funds),
            'source': 'brapi',
        }

    @cached(
        key_prefix='fii_market',
        cache=lambda self: self.cache,
        ttl=FII_MARKET_TTL_SECONDS,
    )
    async def _fetch_market(self) -> list[dict]:
        funds = await self.provider.fetch_fii_market()
        normalized: list[dict] = []
        for fund in funds:
            ticker = self._text(fund.get('symbol'))
            if not ticker:
                continue
            normalized.append({
                'ticker': ticker.upper(),
                'name': self._text(fund.get('name')) or ticker.upper(),
                'cnpj': self._text(fund.get('cnpj')),
                'type': self._text(fund.get('segmentType')),
                'segment': self._text(fund.get('segmentoAtuacao')),
                'mandate': self._text(fund.get('mandate')),
                'management_type': self._text(fund.get('tipoGestao')),
                'administrator': self._text(fund.get('administratorName')),
                'price': self._number(fund.get('price')),
                'nav_per_share': self._number(fund.get('navPerShare')),
                'price_to_nav': self._number(fund.get('priceToNav')),
                'dividend_yield_12m': self._number(fund.get('dividendYield12m')),
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


class FIIProfileReadService:
    """The indicators and distributions a real-estate fund publishes.

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
        if asset.asset_type_id != ASSET_TYPE.FII:
            raise ValidationError(
                'Asset is not a FII',
                context={'asset_id': asset_id, 'asset_type_id': asset.asset_type_id},
            )
        if not asset.ticker:
            raise ValidationError('Asset has no ticker', context={'asset_id': asset_id})

        return await self._fetch_profile(ticker=asset.ticker)

    @cached(
        key_prefix='fii_profile',
        cache=lambda self: self.cache,
        ttl=FII_PROFILE_TTL_SECONDS,
    )
    async def _fetch_profile(self, *, ticker: str) -> dict:
        profile = await self.provider.fetch_fii_profile(ticker=ticker)
        return profile.to_dict()

    async def aclose(self) -> None:
        await self.provider.close()
