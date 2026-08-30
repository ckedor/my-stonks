"""The FII profile, checked against the payloads brapi's FII routes document.

The field names and the envelopes below are the provider's, copied from its
documentation for the seven routes one profile is read from. They are the
contract this adapter exists to translate, so a rename upstream should fail
here rather than quietly empty a card.

The quarterly payloads are published for another fund, and only the symbol was
changed so that every fixture here speaks of one. Which fund an entry belongs to
is what `test_the_composition_of_another_fund_in_the_same_answer_is_left_out`
covers.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.exceptions import IntegrationRateLimited
from app.modules.market_data.adapters.market_data_provider import (
    FII_REPORT_WINDOW,
    MarketDataProvider,
)
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.fii import (
    FIIAllocation,
    FIIDividend,
    FIIIndicators,
    FIIManagement,
    FIIProfile,
)
from app.modules.market_data.service.fii_service import FIIProfileReadService
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 11
TICKER = 'MXRF11'
PRICE_TO_NAV = 1.0180738
DIVIDEND_YIELD_12M = 0.12381
SHAREHOLDERS = 1_357_621
LAST_RATE = 0.08941643
ADMIN_FEE_RATE = 0.000753
CNPJ = '97521225000125'
ADMINISTRATOR = 'BTG PACTUAL SERVICOS FINANCEIROS S/A DTVM'
CRI_HELD = 3354012400
TOTAL_AREA = 2066028.32
VACANCY_RATE = 0.032785


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
        'name': 'FII MAXI RENDA RL',
        'cnpj': CNPJ,
        'mandate': None,
        'tipoGestao': 'Ativa',
        'administratorName': ADMINISTRATOR,
        'administratorWebsite': 'www.btgpactual.com',
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


def _indicators_history_response(**overrides) -> dict:
    """`/v2/fii/indicators/history`: the same numbers, dated by month.

    Newest first, which is the provider's default order and the opposite of
    the order the series is charted in.
    """
    months = [
        {
            'symbol': TICKER,
            'referenceDate': '2025-12-01 00:00:00+00',
            'price': 9.411791,
            'navPerShare': 9.409927,
            'priceToNav': 1.0001981,
            'dividendYield12m': DIVIDEND_YIELD_12M,
            'dividendYield1m': 0.009328,
            'monthlyReturn': 0.007876,
            'totalInvestors': SHAREHOLDERS,
            'sharesOutstanding': 460269540,
            'equity': 4331102700,
            'totalAssets': 4375755000,
            'segmentType': 'papel',
        },
        {
            'symbol': TICKER,
            'referenceDate': '2025-11-01 00:00:00+00',
            'price': 9.463164,
            'navPerShare': 9.42361,
            'priceToNav': 1.0041974,
            'dividendYield12m': 0.125273,
            'dividendYield1m': 0.010665,
            'monthlyReturn': 0.010727,
            'totalInvestors': 1339326,
            'sharesOutstanding': 460269540,
            'equity': 4337401000,
            'totalAssets': 4386052600,
            'segmentType': 'papel',
        },
    ]
    return {'history': months, **overrides}


def _reports_response(**overrides) -> dict:
    """`/v2/fii/reports`: the monthly filing, oldest first here.

    The route sorts, but does not publish by which field, so the newest month
    is deliberately not the first entry.
    """
    older = {
        'symbol': TICKER,
        'referenceDate': '2025-11-01 00:00:00+00',
        'version': 1,
        'totalAssets': 4386052600,
        'equity': 4337401000,
        'cri': 3300000000,
        'totalLiabilities': 48651600,
    }
    newest = {
        'symbol': TICKER,
        'name': None,
        'cnpj': CNPJ,
        'administratorName': ADMINISTRATOR,
        'referenceDate': '2025-12-01 00:00:00+00',
        'version': 2,
        'totalAssets': 4375755000,
        'equity': 4331102700,
        'sharesOutstanding': 460269540,
        'navPerShare': 9.409927,
        'adminFeeRate': ADMIN_FEE_RATE,
        'monthlyReturn': 0.007876,
        'monthlyPatrimonialReturn': -0.001452,
        'monthlyDividendYield': 0.009328,
        'amortizationRate': 0,
        'totalInvestors': SHAREHOLDERS,
        'cash': 0,
        'liquidityNeeds': 24506374,
        'governmentBonds': 0,
        'privateBonds': 0,
        'fixedIncomeFunds': 24506374,
        'totalInvested': 4326274600,
        'realEstateAssets': 9147060,
        'realEstateCompanyShares': 0,
        'realEstateCompanyUnits': 0,
        'cri': CRI_HELD,
        'lci': 0,
        'fiiHoldings': 538337660,
        'receivables': 24973770,
        'rentalReceivables': 0,
        'otherReceivables': 24973770,
        'distributionsPayable': 41155660,
        'adminFeesPayable': 3260833.2,
        'realEstateObligations': 0,
        'totalLiabilities': 44652356,
    }
    return {'reports': [older, newest], **overrides}


def _composition_response(**overrides) -> dict:
    """`/v2/fii/portfolio`: one quarter, item by item."""
    fund = {
        'symbol': TICKER,
        'cnpj': '11728688000147',
        'referenceDate': '2026-03-31',
        'version': 2,
        'summary': {
            'totalItems': 40,
            'declaredValue': 3349501.49,
            'properties': {
                'count': 37,
                'totalArea': TOTAL_AREA,
                'vacancyRate': VACANCY_RATE,
                'averageVacancyRate': 0.03787,
                'propertiesWithVacancy': 37,
            },
            'financialAssets': {'count': 3, 'declaredValue': 3349501.49},
            'lands': {'count': 0, 'totalArea': None},
            'rights': {'count': 0, 'declaredValue': None},
        },
        'allocations': [
            {'assetClass': 'real_estate', 'count': 37, 'value': None},
            {'assetClass': 'cri', 'count': 3, 'value': 3349501.49},
        ],
        'properties': [
            {
                'name': 'DCR',
                'identifier': '925452ac11b478196d767981dee8ecaf',
                'address': 'Av. Hélio Ossamu Daikuara, nº 1.445, Embu das Artes',
                'propertyClass': 'Imóveis para renda acabados',
                'area': 77587.2,
                'unitCount': 1,
                'vacancyRate': 0.135305823641013,
                'delinquencyRate': 0,
                'revenueShare': 0.0398709781486898,
                'leasedRate': None,
                'soldRate': None,
                'constructionProgressActual': None,
                'constructionProgressExpected': None,
                'constructionCostActual': None,
                'constructionCostExpected': None,
                'investedShare': None,
                'confidential': False,
            }
        ],
        'financialAssets': [
            {
                'assetClass': 'cri',
                'name': 'VIRGO COMPANHIA DE SECURITIZAÇÃO',
                'issuer': 'VIRGO COMPANHIA DE SECURITIZAÇÃO',
                'issuerCnpj': '08769451000108',
                'identifier': '8d612f6e7e4fb1da2d668f07c4f91420',
                'quantity': 35,
                'value': 3349501.49,
                'issue': '4',
                'series': '124',
                'ticker': None,
                'maturityDate': None,
                'confidential': False,
            }
        ],
        'fundHoldings': [],
        'lands': [],
        'rights': [],
    }
    return {'fiis': [fund], **overrides}


def _composition_history_response(**overrides) -> dict:
    """`/v2/fii/portfolio/history`: the totals of each quarter, no items."""
    quarter = {
        'symbol': TICKER,
        'cnpj': '11728688000147',
        'referenceDate': '2026-03-31',
        'version': 2,
        'summary': {
            'totalItems': 57,
            'declaredValue': 1256045042.52,
            'properties': {
                'count': 37,
                'totalArea': TOTAL_AREA,
                'vacancyRate': VACANCY_RATE,
                'averageVacancyRate': 0.03787,
                'propertiesWithVacancy': 37,
            },
            'financialAssets': {'count': 20, 'declaredValue': 1256045042.52},
            'lands': {'count': 0, 'totalArea': None},
            'rights': {'count': 0, 'declaredValue': None},
        },
        'allocations': [
            {'assetClass': 'cri', 'count': 1, 'value': 106876.54},
            {'assetClass': 'fii', 'count': 8, 'value': 232510079.3},
            {'assetClass': 'real_estate_company', 'count': 11, 'value': 1023428086.68},
            {'assetClass': 'real_estate', 'count': 37, 'value': None},
        ],
    }
    return {'history': [quarter], **overrides}


def _properties_history_response(**overrides) -> dict:
    """`/v2/fii/properties/history`: how many buildings, how large, how empty."""
    quarters = [
        {
            'symbol': TICKER,
            'cnpj': '11728688000147',
            'referenceDate': '2026-03-31',
            'version': 2,
            'summary': {
                'count': 37,
                'totalArea': TOTAL_AREA,
                'vacancyRate': VACANCY_RATE,
                'averageVacancyRate': 0.03787,
                'propertiesWithVacancy': 37,
            },
        },
        {
            'symbol': TICKER,
            'cnpj': '11728688000147',
            'referenceDate': '2025-12-31',
            'version': 2,
            'summary': {
                'count': 28,
                'totalArea': 1628383.15,
                'vacancyRate': 0.029088,
                'averageVacancyRate': 0.04282,
                'propertiesWithVacancy': 28,
            },
        },
    ]
    return {'history': quarters, **overrides}


#: What each route answers when the provider has nothing for the fund. A test
#: about one section states that section, and the others stay empty rather than
#: reaching the network from a unit test.
EMPTY_ROUTES: dict[str, dict] = {
    'get_fii_indicators_history': {'history': []},
    'get_fii_reports': {'reports': []},
    'get_fii_portfolio': {'fiis': []},
    'get_fii_portfolio_history': {'history': []},
    'get_fii_properties_history': {'history': []},
}


def _route(answer) -> AsyncMock:
    return (
        AsyncMock(side_effect=answer)
        if isinstance(answer, Exception)
        else AsyncMock(return_value=answer)
    )


def _provider(indicators, dividends, **routes) -> MarketDataProvider:
    provider = MarketDataProvider()
    answers = {
        'get_fii_indicators': indicators,
        'get_fii_dividends': dividends,
        **EMPTY_ROUTES,
        **routes,
    }
    for name, answer in answers.items():
        setattr(provider.brapi_client, name, _route(answer))
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
        management=FIIManagement(
            cnpj=CNPJ,
            mandate=None,
            management_type='Ativa',
            administrator_name=ADMINISTRATOR,
            administrator_website='www.btgpactual.com',
        ),
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
async def test_every_route_failing_raises_rather_than_serving_an_empty_profile():
    """A spent quota refuses all seven at once, and must reach the reader.

    A page of empty cards would say the provider covers this fund and has
    nothing on it, which is a different statement from being refused.
    """
    provider = _provider(
        IntegrationRateLimited(provider='brapi', status_code=429),
        RuntimeError('dividends are down'),
        **{name: RuntimeError('brapi is down') for name in EMPTY_ROUTES},
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


@pytest.mark.asyncio
async def test_each_route_is_asked_with_the_parameters_the_provider_documents():
    provider = _provider(_indicators_response(), _dividends_response())

    await provider.fetch_fii_profile(ticker='mxrf11')

    client = provider.brapi_client
    client.get_fii_indicators.assert_awaited_once_with(symbols=TICKER)
    client.get_fii_indicators_history.assert_awaited_once_with(symbols=TICKER, sortOrder='asc')
    client.get_fii_dividends.assert_awaited_once_with(symbols=TICKER, sortOrder='asc')
    client.get_fii_reports.assert_awaited_once_with(
        symbols=TICKER, sortOrder='desc', limit=FII_REPORT_WINDOW
    )
    # No reference date on either quarterly route: the answer is the most
    # recent quarter the fund has filed for.
    client.get_fii_portfolio.assert_awaited_once_with(symbols=TICKER)
    client.get_fii_portfolio_history.assert_awaited_once_with(symbols=TICKER, sortOrder='asc')
    client.get_fii_properties_history.assert_awaited_once_with(symbols=TICKER, sortOrder='asc')


@pytest.mark.asyncio
async def test_the_indicator_history_is_dated_by_month_and_arrives_oldest_first():
    provider = _provider(
        _indicators_response(),
        _dividends_response(),
        get_fii_indicators_history=_indicators_history_response(),
    )

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [month.as_of_date for month in profile.indicators_history] == [
        date(2025, 11, 1),
        date(2025, 12, 1),
    ]
    assert [month.price_to_nav for month in profile.indicators_history] == [1.0041974, 1.0001981]
    assert profile.indicators_history[-1].dividend_yield_12m == DIVIDEND_YIELD_12M


@pytest.mark.asyncio
async def test_a_month_filed_twice_is_charted_once():
    """A correction republishes the month under a new version.

    Two entries for the same month would draw the month twice, so the last one
    read wins and the series keeps one point per month.
    """
    response = _indicators_history_response()
    response['history'].append({**response['history'][0], 'priceToNav': 1.5})
    provider = _provider(
        _indicators_response(), _dividends_response(), get_fii_indicators_history=response
    )

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [month.as_of_date for month in profile.indicators_history] == [
        date(2025, 11, 1),
        date(2025, 12, 1),
    ]
    assert profile.indicators_history[-1].price_to_nav == 1.5


@pytest.mark.asyncio
async def test_the_monthly_filing_read_is_the_most_recent_one_answered():
    provider = _provider(
        _indicators_response(), _dividends_response(), get_fii_reports=_reports_response()
    )

    report = (await provider.fetch_fii_profile(ticker=TICKER)).monthly_report

    assert report.reference_date == date(2025, 12, 1)
    # A rate stays a ratio and an amount stays absolute reais, both as filed.
    assert report.admin_fee_rate == ADMIN_FEE_RATE
    assert report.monthly_patrimonial_return == -0.001452
    assert report.cri == CRI_HELD
    assert report.fii_holdings == 538337660
    assert report.total_liabilities == 44652356


@pytest.mark.asyncio
async def test_the_quarterly_composition_carries_the_buildings_and_the_paper():
    provider = _provider(
        _indicators_response(), _dividends_response(), get_fii_portfolio=_composition_response()
    )

    composition = (await provider.fetch_fii_profile(ticker=TICKER)).composition

    assert composition.reference_date == date(2026, 3, 31)
    assert composition.summary.properties.count == 37
    assert composition.summary.properties.total_area == TOTAL_AREA
    assert composition.summary.properties.vacancy_rate == VACANCY_RATE
    assert composition.summary.financial_assets_count == 3

    building = composition.properties[0]
    assert building.name == 'DCR'
    assert building.area == 77587.2
    assert building.unit_count == 1
    assert building.vacancy_rate == 0.135305823641013
    assert building.revenue_share == 0.0398709781486898
    assert building.confidential is False
    # A building that is not being built leaves the construction fields absent.
    assert building.construction_progress_actual is None

    paper = composition.financial_assets[0]
    assert paper.asset_class == 'cri'
    assert paper.issuer_cnpj == '08769451000108'
    assert paper.quantity == 35
    assert paper.value == 3349501.49
    assert paper.maturity_date is None
    assert composition.fund_holdings == []


@pytest.mark.asyncio
async def test_a_building_the_filing_does_not_price_is_still_counted():
    """The quarterly filing counts buildings and declares no value for them.

    Reading the absent value as zero would put "R$ 0" against the largest half
    of a brick fund; the count is what the filing actually states.
    """
    provider = _provider(
        _indicators_response(), _dividends_response(), get_fii_portfolio=_composition_response()
    )

    composition = (await provider.fetch_fii_profile(ticker=TICKER)).composition

    assert composition.allocations == [
        FIIAllocation(asset_class='real_estate', count=37, value=None),
        FIIAllocation(asset_class='cri', count=3, value=3349501.49),
    ]


@pytest.mark.asyncio
async def test_the_composition_of_another_fund_in_the_same_answer_is_left_out():
    response = _composition_response()
    response['fiis'].insert(0, {**response['fiis'][0], 'symbol': 'HGLG11', 'allocations': []})
    provider = _provider(_indicators_response(), _dividends_response(), get_fii_portfolio=response)

    composition = (await provider.fetch_fii_profile(ticker=TICKER)).composition

    assert [allocation.asset_class for allocation in composition.allocations] == [
        'real_estate',
        'cri',
    ]


@pytest.mark.asyncio
async def test_the_quarterly_histories_arrive_oldest_first():
    provider = _provider(
        _indicators_response(),
        _dividends_response(),
        get_fii_portfolio_history=_composition_history_response(),
        get_fii_properties_history=_properties_history_response(),
    )

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert [quarter.reference_date for quarter in profile.properties_history] == [
        date(2025, 12, 31),
        date(2026, 3, 31),
    ]
    assert [quarter.summary.vacancy_rate for quarter in profile.properties_history] == [
        0.029088,
        VACANCY_RATE,
    ]
    assert [quarter.reference_date for quarter in profile.composition_history] == [
        date(2026, 3, 31)
    ]
    assert profile.composition_history[0].summary.financial_assets_value == 1256045042.52


@pytest.mark.asyncio
async def test_a_quarterly_route_failing_leaves_the_monthly_sections_on_the_page():
    provider = _provider(
        _indicators_response(),
        _dividends_response(),
        get_fii_portfolio=RuntimeError('quarterly filings are down'),
        get_fii_properties_history=RuntimeError('quarterly filings are down'),
        get_fii_reports=_reports_response(),
    )

    profile = await provider.fetch_fii_profile(ticker=TICKER)

    assert profile.composition is None
    assert profile.properties_history == []
    assert profile.monthly_report.reference_date == date(2025, 12, 1)
    assert profile.indicators.price_to_nav == PRICE_TO_NAV


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
