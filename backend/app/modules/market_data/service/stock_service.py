"""Reads of a listed company's published profile."""

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE

#: A company refiles quarterly and the market reprices the multiples daily, so
#: a few hours of staleness costs a reader almost nothing. It buys a great deal
#: here: the profile is nine provider routes, and without the cache every open
#: of the page would spend nine calls against a quota measured per minute. The
#: cache fills on miss; nothing warms it.
STOCK_PROFILE_TTL_SECONDS = 21600


class StockProfileReadService:
    """The filings and multiples a listed company publishes.

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
        if asset.asset_type_id != ASSET_TYPE.STOCK:
            raise ValidationError(
                'Asset is not a stock',
                context={'asset_id': asset_id, 'asset_type_id': asset.asset_type_id},
            )
        if not asset.ticker:
            raise ValidationError('Asset has no ticker', context={'asset_id': asset_id})

        return await self._fetch_profile(ticker=asset.ticker)

    # A busca do ativo fica fora do cache de propósito: ela é a verificação de
    # que o id existe e é uma ação, e uma verificação em cache deixa de ser uma
    # verificação. Só o fan-out por ticker entra, e assim dois ids do mesmo
    # papel dividem uma entrada.
    @cached(
        key_prefix='stock_profile',
        cache=lambda self: self.cache,
        ttl=STOCK_PROFILE_TTL_SECONDS,
    )
    async def _fetch_profile(self, *, ticker: str) -> dict:
        profile = await self.provider.fetch_stock_profile(ticker=ticker)
        return profile.to_dict()

    async def aclose(self) -> None:
        await self.provider.close()
