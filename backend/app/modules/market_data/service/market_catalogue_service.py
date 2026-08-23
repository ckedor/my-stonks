"""Provider-backed market catalogues for stocks, ETFs and cryptoassets."""

import math

from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE

MARKET_CATALOGUE_TTL_SECONDS = 21600
MARKET_ASSET_TYPES = {
    'stock': ASSET_TYPE.STOCK,
    'etf': ASSET_TYPE.ETF,
    'crypto': ASSET_TYPE.CRIPTO,
}


class MarketCatalogueReadService:
    """A BRAPI universe enriched with ids of assets registered in the app."""

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

    async def list_market(self, kind: str) -> dict:
        asset_type_id = MARKET_ASSET_TYPES.get(kind)
        if asset_type_id is None:
            raise ValidationError('Unsupported market catalogue', context={'kind': kind})

        provider_assets = await self._fetch_market(kind)
        tickers = [asset['ticker'] for asset in provider_assets]
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(tickers, asset_type_id)
        asset_ids = {asset.ticker.upper(): asset.id for asset in assets if asset.ticker}

        return {
            'assets': [
                {**asset, 'asset_id': asset_ids.get(asset['ticker'])} for asset in provider_assets
            ],
            'total': len(provider_assets),
            'source': 'brapi',
        }

    @cached(
        key_prefix='market_catalogue',
        cache=lambda self: self.cache,
        ttl=MARKET_CATALOGUE_TTL_SECONDS,
    )
    async def _fetch_market(self, kind: str) -> list[dict]:
        rows = await self.provider.fetch_market_catalogue(kind)
        normalized: dict[str, dict] = {}

        for row in rows:
            ticker = self._text(row.get('coin') if kind == 'crypto' else row.get('stock'))
            if not ticker:
                continue
            ticker = ticker.upper()

            if kind == 'crypto':
                name = self._text(row.get('coinName')) or ticker
                price = self._number(row.get('regularMarketPrice'))
                change = self._number(row.get('regularMarketChangePercent'))
                volume = self._number(row.get('regularMarketVolume'))
                market_cap = self._positive_number(row.get('marketCap'))
                logo_url = self._text(row.get('coinImageUrl'))
            else:
                name = self._text(row.get('name')) or ticker
                price = self._number(row.get('close'))
                change = self._number(row.get('change'))
                volume = self._number(row.get('volume'))
                market_cap = self._positive_number(row.get('market_cap'))
                logo_url = self._text(row.get('logo'))

            normalized[ticker] = {
                'ticker': ticker,
                'name': name,
                'price': price,
                'change_percent': change,
                'volume': volume,
                'market_cap': market_cap,
                'currency': 'BRL',
                'logo_url': logo_url,
            }

        return sorted(
            normalized.values(),
            key=lambda asset: asset['volume'] if asset['volume'] is not None else -1,
            reverse=True,
        )

    @staticmethod
    def _text(value: object) -> str | None:
        text = str(value).strip() if value is not None else ''
        return text or None

    @staticmethod
    def _number(value: object) -> float | None:
        if value is None or isinstance(value, bool):
            return None
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        return number if math.isfinite(number) else None

    @classmethod
    def _positive_number(cls, value: object) -> float | None:
        number = cls._number(value)
        return number if number is not None and number > 0 else None

    async def aclose(self) -> None:
        await self.provider.close()
