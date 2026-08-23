from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.service.fii_service import FIIMarketReadService


class MemoryCache:
    def __init__(self):
        self.value = None

    async def get_json(self, _key):
        return self.value

    async def set_json(self, _key, value, **_kwargs):
        self.value = value


class FakeUoW:
    def __init__(self, assets):
        self.assets = assets

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None


@pytest.mark.asyncio
async def test_fii_market_normalizes_provider_and_links_registered_assets():
    provider = SimpleNamespace(
        fetch_fii_market=AsyncMock(
            return_value=[
                {
                    'symbol': 'XPML11',
                    'name': 'XP Malls',
                    'segmentType': 'tijolo',
                    'segmentoAtuacao': 'Shoppings',
                    'price': 98.4,
                    'priceToNav': 0.89,
                    'dividendYield12m': 0.112,
                    'totalInvestors': 733101,
                }
            ]
        )
    )
    assets = SimpleNamespace(
        get_by_tickers=AsyncMock(return_value=[SimpleNamespace(id=42, ticker='XPML11')])
    )
    service = FIIMarketReadService(
        uow=FakeUoW(assets),
        provider=provider,
        cache=MemoryCache(),
    )

    result = await service.list_market()

    assert result['total'] == 1
    assert result['source'] == 'brapi'
    assert result['funds'][0] == {
        'asset_id': 42,
        'ticker': 'XPML11',
        'name': 'XP Malls',
        'cnpj': None,
        'type': 'tijolo',
        'segment': 'Shoppings',
        'mandate': None,
        'management_type': None,
        'administrator': None,
        'price': 98.4,
        'nav_per_share': None,
        'price_to_nav': 0.89,
        'dividend_yield_12m': 0.112,
        'investors': 733101,
    }
    assets.get_by_tickers.assert_awaited_once_with(['XPML11'], ASSET_TYPE.FII)
