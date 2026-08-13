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
