from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.service.market_catalogue_service import MarketCatalogueReadService


class MemoryCache:
    def __init__(self):
        self.values = {}

    async def get_json(self, key):
        return self.values.get(key)

    async def set_json(self, key, value, **_kwargs):
        self.values[key] = value


class FakeUoW:
    def __init__(self, assets):
        self.assets = assets

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None


@pytest.mark.asyncio
async def test_stock_market_normalizes_provider_and_links_registered_assets():
    provider = SimpleNamespace(
        fetch_market_catalogue=AsyncMock(
            return_value=[
                {
                    'stock': 'PETR4',
                    'name': 'Petrobras',
                    'close': 44.3,
                    'change': -0.05,
                    'volume': 52657800,
                    'market_cap': 603115978244,
                    'logo': 'https://example.test/petr4.svg',
                }
            ]
        )
    )
    assets = SimpleNamespace(
        get_by_tickers=AsyncMock(return_value=[SimpleNamespace(id=42, ticker='PETR4')])
    )
    service = MarketCatalogueReadService(
        uow=FakeUoW(assets), provider=provider, cache=MemoryCache()
    )

    result = await service.list_market('stock')

    assert result == {
        'assets': [
            {
                'asset_id': 42,
                'ticker': 'PETR4',
                'name': 'Petrobras',
                'price': 44.3,
                'change_percent': -0.05,
                'volume': 52657800.0,
                'market_cap': 603115978244.0,
                'currency': 'BRL',
                'logo_url': 'https://example.test/petr4.svg',
            }
        ],
        'total': 1,
        'source': 'brapi',
    }
    assets.get_by_tickers.assert_awaited_once_with(['PETR4'], ASSET_TYPE.STOCK)


@pytest.mark.asyncio
async def test_crypto_market_treats_zero_market_cap_as_unknown_and_sorts_by_volume():
    provider = SimpleNamespace(
        fetch_market_catalogue=AsyncMock(
            return_value=[
                {'coin': 'ETH', 'coinName': 'Ethereum', 'regularMarketVolume': 20, 'marketCap': 0},
                {'coin': 'BTC', 'coinName': 'Bitcoin', 'regularMarketVolume': 40, 'marketCap': 0},
            ]
        )
    )
    assets = SimpleNamespace(get_by_tickers=AsyncMock(return_value=[]))
    service = MarketCatalogueReadService(
        uow=FakeUoW(assets), provider=provider, cache=MemoryCache()
    )

    result = await service.list_market('crypto')

    assert [asset['ticker'] for asset in result['assets']] == ['BTC', 'ETH']
    assert result['assets'][0]['market_cap'] is None
    assets.get_by_tickers.assert_awaited_once_with(['BTC', 'ETH'], ASSET_TYPE.CRIPTO)
