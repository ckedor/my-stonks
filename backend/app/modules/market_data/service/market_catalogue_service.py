"""Provider-backed market catalogues for stocks, ETFs and cryptoassets."""

import math
from datetime import date, timedelta

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
    'fii': ASSET_TYPE.FII,
    'bdr': ASSET_TYPE.BDR,
    'crypto': ASSET_TYPE.CRIPTO,
}

#: As classes de fora da B3. O provedor de catálogo cobre só o mercado
#: brasileiro, então aqui o universo é o cadastro da própria aplicação — e o
#: preço vem da série de cotações que a ingestão já mantém.
REGISTERED_ASSET_TYPES = {
    'stock-us': ASSET_TYPE.STOCK,
    'etf-us': ASSET_TYPE.ETF,
}

#: Janela para achar o último fechamento e o anterior a ele. Duas semanas
#: cobrem feriado e fim de semana sem carregar a série inteira.
REGISTERED_QUOTE_WINDOW_DAYS = 14


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
        if kind in REGISTERED_ASSET_TYPES:
            return await self._list_registered(kind)

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

    async def _list_registered(self, kind: str) -> dict:
        """O mercado americano, montado do cadastro em vez do provedor.

        A BRAPI só fala da B3, então não há catálogo a folhear aqui: a tela
        mostra os papéis que a aplicação conhece, com o último fechamento e a
        variação contra o fechamento anterior.
        """
        asset_type_id = REGISTERED_ASSET_TYPES[kind]
        async with self.uow as uow:
            assets = await uow.assets.get_registered_by_market(
                asset_type_id,
                brazilian=False,
            )
            asset_ids = [asset.id for asset in assets]
            start = date.today() - timedelta(days=REGISTERED_QUOTE_WINDOW_DAYS)
            quotes = await uow.quotes.get_quotes(asset_ids, start_date=start)

        closes: dict[int, list[float]] = {}
        volumes: dict[int, float | None] = {}
        for quote in quotes:
            close = self._number(quote.close)
            if close is None:
                continue
            closes.setdefault(quote.asset_id, []).append(close)
            volumes[quote.asset_id] = self._number(quote.volume)

        rows = []
        for asset in assets:
            series = closes.get(asset.id, [])
            price = series[-1] if series else None
            previous = series[-2] if len(series) > 1 else None
            change = (
                (price - previous) / previous * 100
                if price is not None and previous not in (None, 0)
                else None
            )
            rows.append({
                'asset_id': asset.id,
                'ticker': asset.ticker,
                'name': asset.name,
                'price': price,
                'change_percent': change,
                'volume': volumes.get(asset.id),
                'market_cap': None,
                'currency': 'USD',
                'logo_url': asset.logo_url,
            })

        rows.sort(key=lambda row: row['ticker'] or '')
        return {'assets': rows, 'total': len(rows), 'source': 'registry'}

    async def fetch_catalogue(self, kind: str) -> list[dict]:
        """O universo do provedor para uma classe, normalizado e em cache.

        Público porque a sincronização do cadastro lê o mesmo catálogo que a
        tela: duas leituras do provedor para a mesma pergunta seriam duas
        chances de discordar — e a segunda pagaria de novo por um dado que o
        cache já tem.
        """
        return await self._fetch_market(kind)

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
