"""The FII profile, checked against the payloads brapi's FII routes document.

The field names and the envelopes below are the provider's, copied from its
documentation for `/v2/fii/indicators` and `/v2/fii/dividends`. They are the
contract this adapter exists to translate, so a rename upstream should fail
here rather than quietly empty a card.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.exceptions import IntegrationRateLimited
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.fii import FIIDividend, FIIIndicators, FIIProfile
from app.modules.market_data.service.fii_service import FIIProfileReadService
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 11
TICKER = 'MXRF11'
PRICE_TO_NAV = 1.0180738
DIVIDEND_YIELD_12M = 0.12381
SHAREHOLDERS = 1_357_621
LAST_RATE = 0.08941643


def _indicators_response(**overrides) -> dict:
    fund = {
        'symbol': TICKER,
        'asOfDate': '2025-12-01 00:00:00+00',
        'price': 9.58,
        'navPerShare': 9.409927,
        'priceToNav': PRICE_TO_NAV,
        'dividendYield12m': DIVIDEND_YIELD_12M,
        'dividendYield1m': 0.009328,
        'monthlyReturn': 0.007876,
        'totalInvestors': SHAREHOLDERS,
        'sharesOutstanding': 460269540,
        'equity': 4331102700,
        'totalAssets': 4375755000,
        'segmentType': 'papel',
        # Not in the provider's documented example, but in what it answers.
        'segmentoAtuacao': 'Papéis',
    }
    fund.update(overrides)
    return {'fiis': [fund]}


def _dividends_response() -> dict:
    return {
        'dividends': [
            {
                'symbol': TICKER,
                'approvedOn': None,
                'label': 'RENDIMENTO',
                'lastDatePrior': '2025-11-14 00:00:00+00',
                'paymentDate': '2025-11-14 00:00:00+00',
                'rate': 0.09,
                'relatedTo': None,
                'isinCode': None,
                'remarks': '',
            },
            {
                'symbol': TICKER,
                'approvedOn': None,
                'label': 'RENDIMENTO',
                'lastDatePrior': '2025-11-28 00:00:00+00',
                'paymentDate': '2025-12-01 00:00:00+00',
                'rate': LAST_RATE,
                'relatedTo': None,
                'isinCode': None,
                'remarks': '',
            },
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
async def test_provider_maps_the_documented_fii_payloads_onto_the_domain():
    provider = _provider(_indicators_response(), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker='mxrf11')

    provider.brapi_client.get_fii_indicators.assert_awaited_once_with(symbols=TICKER)
    provider.brapi_client.get_fii_dividends.assert_awaited_once_with(
        symbols=TICKER,
        sortOrder='asc',
    )
    assert profile == FIIProfile(
        ticker=TICKER,
        indicators=FIIIndicators(
            as_of_date=date(2025, 12, 1),
            segment_type='papel',
            segment='Papéis',
            price=9.58,
            nav_per_share=9.409927,
            price_to_nav=PRICE_TO_NAV,
            dividend_yield_12m=DIVIDEND_YIELD_12M,
            dividend_yield_1m=0.009328,
            monthly_return=0.007876,
            equity=4331102700,
            total_assets=4375755000,
            shares_outstanding=460269540,
            shareholders=SHAREHOLDERS,
        ),
        dividends=[
            FIIDividend(
                payment_date=date(2025, 11, 14),
                value_per_share=0.09,
                ex_date=date(2025, 11, 14),
                event_type='RENDIMENTO',
            ),
            FIIDividend(
                payment_date=date(2025, 12, 1),
                value_per_share=LAST_RATE,
                ex_date=date(2025, 11, 28),
                event_type='RENDIMENTO',
            ),
        ],
    )


@pytest.mark.asyncio
async def test_ratios_reach_the_domain_unscaled():
    """0.12381 is a yield of 12.381%, and the domain keeps it as the ratio."""
    provider = _provider(_indicators_response(), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.indicators.dividend_yield_12m == DIVIDEND_YIELD_12M
    assert profile.indicators.price_to_nav == PRICE_TO_NAV


@pytest.mark.asyncio
async def test_the_amount_paid_is_read_from_rate_and_never_from_a_yield():
    provider = _provider(_indicators_response(), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [dividend.value_per_share for dividend in profile.dividends] == [0.09, LAST_RATE]


@pytest.mark.asyncio
async def test_amortizations_stay_distinguishable_from_income():
    response = _dividends_response()
    response['dividends'].append({
        'symbol': TICKER,
        'label': 'AMORTIZACAO',
        'lastDatePrior': '2025-12-20 00:00:00+00',
        'paymentDate': '2025-12-22 00:00:00+00',
        'rate': 1.5,
    })
    provider = _provider(_indicators_response(), response)

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [dividend.event_type for dividend in profile.dividends] == [
        'RENDIMENTO',
        'RENDIMENTO',
        'AMORTIZACAO',
    ]
    assert [dividend.is_income for dividend in profile.dividends] == [True, True, False]


@pytest.mark.asyncio
async def test_payments_of_other_funds_in_the_same_response_are_left_out():
    response = _dividends_response()
    response['dividends'].append({
        'symbol': 'HGLG11',
        'label': 'RENDIMENTO',
        'paymentDate': '2025-12-05 00:00:00+00',
        'rate': 1.1,
    })
    provider = _provider(_indicators_response(), response)

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [dividend.value_per_share for dividend in profile.dividends] == [0.09, LAST_RATE]


@pytest.mark.asyncio
async def test_one_failing_provider_route_does_not_cost_the_other_half():
    provider = _provider(RuntimeError('indicators are down'), _dividends_response())

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.indicators is None
    assert [dividend.value_per_share for dividend in profile.dividends] == [0.09, LAST_RATE]


@pytest.mark.asyncio
async def test_both_routes_failing_raises_rather_than_serving_an_empty_profile():
    provider = _provider(
        IntegrationRateLimited(provider='brapi', status_code=429),
        RuntimeError('dividends are down'),
    )

    with pytest.raises(IntegrationRateLimited):
        await provider.fetch_fii_profile(ticker=TICKER)


@pytest.mark.asyncio
async def test_an_indicator_the_provider_omits_is_unknown_rather_than_zero():
    response = _indicators_response()
    del response['fiis'][0]['priceToNav']
    del response['fiis'][0]['totalInvestors']
    response['fiis'][0]['equity'] = None
    provider = _provider(response, {'dividends': []})

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.indicators.price_to_nav is None
    assert profile.indicators.shareholders is None
    assert profile.indicators.equity is None
    assert profile.indicators.dividend_yield_12m == DIVIDEND_YIELD_12M
    assert profile.dividends == []


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
    assert profile['indicators']['price_to_nav'] == PRICE_TO_NAV
    assert profile['dividends'][-1] == {
        'payment_date': '2025-12-01',
        'ex_date': '2025-11-28',
        'value_per_share': LAST_RATE,
        'event_type': 'RENDIMENTO',
    }


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


@pytest.mark.asyncio
async def test_portfolio_dividends_read_the_same_route_as_the_market_page():
    """Uma rota e um mapeamento para os dois lados.

    A consolidação da carteira lia outro provedor, que não publicava o rótulo
    do evento; ler daqui é o que faz um provento ser o mesmo fato na tela do
    fundo e na carteira.
    """
    provider = _provider(_indicators_response(), _dividends_response())

    # Caixa e repetição não viram requisições a mais: o ticker é normalizado
    # uma vez, aqui, e não em cada chamador.
    dividends = await provider.fetch_fii_dividends(['mxrf11', 'MXRF11', ''])

    provider.brapi_client.get_fii_dividends.assert_awaited_once_with(
        symbols=TICKER, sortOrder='asc'
    )
    assert [payment.value_per_share for payment in dividends[TICKER]] == [0.09, LAST_RATE]


@pytest.mark.asyncio
async def test_a_fund_whose_dividends_fail_does_not_fail_the_others():
    provider = _provider(_indicators_response(), _dividends_response())
    provider.brapi_client.get_fii_dividends = AsyncMock(side_effect=RuntimeError('502'))

    assert await provider.fetch_fii_dividends([TICKER]) == {TICKER: []}
