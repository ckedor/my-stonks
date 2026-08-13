from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.fii import FIIDividend, FIIIndicators, FIIProfile
from app.modules.market_data.service.fii_service import FIIProfileReadService
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 11
TICKER = 'XPML11'
PRICE_TO_BOOK = 0.94
DIVIDEND_YIELD_12M = 9.42
SHAREHOLDERS = 312_000
LAST_DIVIDEND = 0.95


def _indicators_response(**overrides) -> dict:
    fund = {
        'symbol': TICKER,
        'asOfDate': '2026-07-31',
        'price': 104.2,
        'navPerShare': 110.5,
        'priceToNav': PRICE_TO_BOOK,
        'dividendYield12m': DIVIDEND_YIELD_12M,
        'dividendYield1m': 0.91,
        'monthlyReturn': 1.4,
        'equity': 4_200_000_000,
        'totalAssets': 4_500_000_000,
        'sharesOutstanding': 38_000_000,
        'totalInvestors': SHAREHOLDERS,
        'segmentoAtuacao': 'Shoppings',
        'segmentType': 'Tijolo',
        'managerName': 'XP Vista',
        'adminName': 'BRL Trust',
    }
    fund.update(overrides)
    return {'fiis': [fund]}


def _dividends_response() -> dict:
    return {
        'fiis': [
            {
                'symbol': TICKER,
                'dividends': [
                    {'paymentDate': '2026-06-15', 'rate': 0.9},
                    {'paymentDate': '2026-07-15', 'rate': LAST_DIVIDEND},
                ],
            }
        ]
    }


def _provider(indicators, dividends) -> MarketDataProvider:
    provider = MarketDataProvider()
    provider.brapi_client.get_fii_indicators = AsyncMock(
        side_effect=indicators if isinstance(indicators, Exception) else None,
        return_value=None if isinstance(indicators, Exception) else indicators,
    )
    provider.brapi_client.get_fii_dividends = AsyncMock(
        side_effect=dividends if isinstance(dividends, Exception) else None,
        return_value=None if isinstance(dividends, Exception) else dividends,
    )
    return provider


@pytest.mark.asyncio
async def test_provider_maps_the_documented_fii_fields_onto_the_domain():
    provider = _provider(_indicators_response(), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker='xpml11')

    provider.brapi_client.get_fii_indicators.assert_awaited_once_with(symbols=TICKER)
    provider.brapi_client.get_fii_dividends.assert_awaited_once_with(symbols=TICKER)
    assert profile == FIIProfile(
        ticker=TICKER,
        indicators=FIIIndicators(
            as_of_date=date(2026, 7, 31),
            segment='Shoppings',
            segment_type='Tijolo',
            manager='XP Vista',
            administrator='BRL Trust',
            price=104.2,
            book_value_per_share=110.5,
            price_to_book=PRICE_TO_BOOK,
            dividend_yield_12m=DIVIDEND_YIELD_12M,
            dividend_yield_1m=0.91,
            monthly_return=1.4,
            equity=4_200_000_000,
            total_assets=4_500_000_000,
            shares_outstanding=38_000_000,
            shareholders=SHAREHOLDERS,
        ),
        dividends=[
            FIIDividend(date=date(2026, 6, 15), value_per_share=0.9),
            FIIDividend(date=date(2026, 7, 15), value_per_share=LAST_DIVIDEND),
        ],
    )


@pytest.mark.asyncio
async def test_one_failing_provider_route_does_not_cost_the_other_half():
    provider = _provider(RuntimeError('indicators are down'), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.indicators is None
    assert [dividend.value_per_share for dividend in profile.dividends] == [0.9, LAST_DIVIDEND]


@pytest.mark.asyncio
async def test_an_indicator_the_provider_omits_is_empty_rather_than_fatal():
    response = _indicators_response()
    del response['fiis'][0]['priceToNav']
    del response['fiis'][0]['totalInvestors']
    response['fiis'][0]['equity'] = None
    provider = _provider(response, {'fiis': []})

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.indicators.price_to_book is None
    assert profile.indicators.shareholders is None
    assert profile.indicators.equity is None
    assert profile.indicators.dividend_yield_12m == DIVIDEND_YIELD_12M
    assert profile.dividends == []


@pytest.mark.asyncio
async def test_dividends_are_deduplicated_by_date_and_served_oldest_first():
    provider = _provider(
        {'fiis': []},
        {
            'fiis': [
                {
                    'symbol': TICKER,
                    'dividends': [
                        {'paymentDate': '2026-07-15', 'rate': 0.5},
                        {'paymentDate': '2026-05-15', 'rate': 0.8},
                        {'paymentDate': '2026-07-15', 'rate': LAST_DIVIDEND},
                        {'paymentDate': None, 'rate': 1.0},
                    ],
                }
            ]
        },
    )

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [(item.date, item.value_per_share) for item in profile.dividends] == [
        (date(2026, 5, 15), 0.8),
        (date(2026, 7, 15), LAST_DIVIDEND),
    ]


def _service(asset, provider) -> FIIProfileReadService:
    return FIIProfileReadService(
        uow=FakeUnitOfWork(
            assets=SimpleNamespace(get_by_ids=AsyncMock(return_value=[asset] if asset else []))
        ),
        provider=provider,
        cache=FakeCache(),
    )


@pytest.mark.asyncio
async def test_profile_read_resolves_the_registered_asset_before_asking_the_provider():
    provider = _provider(_indicators_response(), _dividends_response())
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.FII),
        provider,
    )

    profile = await service.get_profile(asset_id=ASSET_ID)

    provider.brapi_client.get_fii_indicators.assert_awaited_once_with(symbols=TICKER)
    assert profile['ticker'] == TICKER
    assert profile['indicators']['price_to_book'] == PRICE_TO_BOOK
    assert profile['dividends'][-1] == {'date': '2026-07-15', 'value_per_share': LAST_DIVIDEND}


@pytest.mark.asyncio
async def test_a_second_read_of_the_same_fund_is_served_from_the_cache():
    provider = _provider(_indicators_response(), _dividends_response())
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.FII),
        provider,
    )

    first = await service.get_profile(asset_id=ASSET_ID)
    second = await service.get_profile(asset_id=ASSET_ID)

    assert first == second
    provider.brapi_client.get_fii_indicators.assert_awaited_once()


@pytest.mark.asyncio
async def test_profile_read_refuses_assets_that_are_not_real_estate_funds():
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker='PETR4', asset_type_id=ASSET_TYPE.STOCK),
        _provider(_indicators_response(), _dividends_response()),
    )

    with pytest.raises(ValidationError):
        await service.get_profile(asset_id=ASSET_ID)


@pytest.mark.asyncio
async def test_profile_read_reports_an_unknown_asset():
    service = _service(None, _provider(_indicators_response(), _dividends_response()))

    with pytest.raises(NotFoundError):
        await service.get_profile(asset_id=ASSET_ID)
