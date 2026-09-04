"""The investment-fund profile, checked against brapi's documented payloads.

The field names and the envelopes below are the provider's, copied from its
documentation for the six routes one profile is read from. They are the contract
this adapter exists to translate, so a rename upstream should fail here rather
than quietly empty a card.

An investment fund here is one that is neither a real-estate fund nor an ETF.
The catalogue route answers for those two as well, and
``test_the_catalogue_leaves_out_real_estate_funds_and_etfs`` is what covers
their exclusion — which is on the kind the provider states and never on the
ticker, since JURO11 ends in 11 and is an FI-Infra.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.infra.exceptions import IntegrationRateLimited
from app.modules.market_data.adapters.market_data_provider import (
    FUND_HISTORY_LIMIT,
    MarketDataProvider,
)
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.investment_fund import (
    InvestmentFundDividend,
    InvestmentFundIdentity,
    InvestmentFundIndicators,
    InvestmentFundInvestorBreakdown,
    InvestmentFundNavPoint,
    InvestmentFundRisk,
)
from app.modules.market_data.service.investment_fund_service import (
    InvestmentFundMarketReadService,
    InvestmentFundProfileReadService,
)
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 42
TICKER = 'JURO11'
CNPJ = '42730834000100'
LEGAL_NAME = 'SPARTA INFRA FIC FI INFRA RENDA FIXA CP'
ADMINISTRATOR = 'SPARTA ADMINISTRADORA DE RECURSOS LTDA'
PRICE_TO_NAV = 0.9777272
NAV_PER_SHARE = 99.19945
EQUITY = 2040699000
SHAREHOLDERS = 92710
LAST_RATE = 0.5
PUBLIC_BOND_VALUE = 6403800


def _identity_response(**overrides) -> dict:
    """`/v2/funds/list`: who the fund is, and which family it belongs to."""
    fund = {
        'symbol': TICKER,
        'cnpj': CNPJ,
        'formattedCnpj': '42.730.834/0001-00',
        'name': 'SPARTA INFRA',
        'legalName': LEGAL_NAME,
        'assetType': 'fiinfra',
        'cvmClassType': None,
        'cvmClassification': None,
        'anbimaClassification': None,
        'b3Classification': 'Financeiro/Fundos/FI-INFRA',
        'isin': None,
        'administratorName': ADMINISTRATOR,
        'administratorCnpj': None,
        'managerName': None,
        'managerCnpj': None,
        'status': None,
        'price': 96.99,
        'navPerShare': NAV_PER_SHARE,
        'priceToNav': PRICE_TO_NAV,
        'equity': EQUITY,
        'totalAssets': 2041704100,
        'totalInvestors': SHAREHOLDERS,
        'updatedAt': '2026-06-21T21:06:37.434Z',
    }
    fund.update(overrides)
    return {'funds': [fund]}


def _indicators_response(**overrides) -> dict:
    """`/v2/funds/indicators`: the fund's numbers as of its last filing."""
    fund = {
        'symbol': TICKER,
        'cnpj': CNPJ,
        'name': 'SPARTA INFRA',
        'assetType': 'fiinfra',
        'asOfDate': '2026-06-18T00:00:00.000Z',
        'price': 96.99,
        'navPerShare': NAV_PER_SHARE,
        'priceToNav': PRICE_TO_NAV,
        'equity': EQUITY,
        'totalAssets': 2041704100,
        'totalInvestors': SHAREHOLDERS,
        'dailyApplications': 0,
        'dailyRedemptions': 0,
        'sharesOutstanding': None,
        'monthlyReturn': None,
        'patrimonialMonthlyReturn': None,
        'dividendYieldMonthly': None,
    }
    fund.update(overrides)
    return {'funds': [fund]}


def _nav_history_response() -> dict:
    """`/v2/funds/nav/history`: the share value as filed, newest first here.

    The provider's default order is descending and the series is charted the
    other way, which is what the adapter is expected to fix.
    """
    return {
        'history': [
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'date': '2026-06-18T00:00:00.000Z',
                'classOrSeries': None,
                'totalAssets': 2041704100,
                'navPerShare': NAV_PER_SHARE,
                'equity': EQUITY,
                'dailyApplications': 0,
                'dailyRedemptions': 0,
                'totalInvestors': SHAREHOLDERS,
                'monthlyReturn': None,
            },
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'date': '2026-06-17T00:00:00.000Z',
                'classOrSeries': None,
                'totalAssets': 2040000000,
                'navPerShare': 99.1,
                'equity': 2039000000,
                'dailyApplications': 1500,
                'dailyRedemptions': 0,
                'totalInvestors': 92700,
                'monthlyReturn': None,
            },
        ]
    }


def _dividends_response() -> dict:
    return {
        'dividends': [
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'assetType': 'fiinfra',
                'declaredDate': '2026-04-28T00:00:00.000Z',
                'lastDatePrior': '2026-04-28T00:00:00.000Z',
                'paymentDate': '2026-05-14T00:00:00.000Z',
                'rate': 0.48,
                'label': 'RENDIMENTO',
                'isinCode': 'BRJUROCTF002',
            },
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'assetType': 'fiinfra',
                'declaredDate': '2026-05-29T00:00:00.000Z',
                'lastDatePrior': '2026-05-29T00:00:00.000Z',
                'paymentDate': '2026-06-13T00:00:00.000Z',
                'rate': LAST_RATE,
                'label': 'RENDIMENTO',
                'isinCode': 'BRJUROCTF002',
            },
        ]
    }


def _regulatory_profile_response() -> dict:
    """`/v2/funds/profile`: the monthly filing with the regulator."""
    return {
        'profiles': [
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'referenceDate': '2026-05-31T00:00:00.000Z',
                'investorBreakdown': {
                    'individualRetail': 0,
                    'individualRetailPercent': 0,
                    'legalEntities': 0,
                    'legalEntitiesPercent': 0,
                    'fundsOrClubs': 1,
                    'fundsOrClubsPercent': 100,
                    'nonResidents': 0,
                    'nonResidentsPercent': 0,
                    'other': 0,
                    'otherPercent': 0,
                },
                'risk': {
                    'riskModel': 'Modelos Não-Paramétricos',
                    'portfolioVar': 0,
                    'dailyQuotaVariationPercent': 0,
                    'stressedDailyQuotaVariationPercent': 0,
                    'privateCreditExposurePercent': 0,
                },
                'liquidity': None,
                'concentration': {'topCotistaPercent': 0},
                'privateCredit': {'exposurePercent': 0},
            }
        ]
    }


def _portfolio_response() -> dict:
    """`/v2/funds/portfolio`: one quarter, in six lists of one shape."""
    return {
        'funds': [
            {
                'symbol': TICKER,
                'cnpj': CNPJ,
                'name': LEGAL_NAME,
                'referenceDate': '2026-05-31T00:00:00.000Z',
                'summary': {
                    'marketValue': 2083851261,
                    'holdingsCount': 7,
                    'publicBondsValue': PUBLIC_BOND_VALUE,
                    'fundHoldingsValue': 2053162240,
                    'creditAssetsValue': 0,
                    'listedSecuritiesValue': 0,
                    'receivablesValue': 12371910,
                    'payablesValue': 11913311,
                },
                'publicBonds': [
                    {
                        'bucket': 'publicBonds',
                        'assetType': 'Título público federal',
                        'assetName': 'NOTAS DO TESOURO NACIONAL SERIE B',
                        'issuerName': None,
                        'issuerCnpj': None,
                        'isin': 'BRSTNCNTB716',
                        'selicCode': '760199',
                        'quantity': 1434,
                        'marketValue': PUBLIC_BOND_VALUE,
                        'costValue': None,
                        'maturityDate': '2029-05-15T00:00:00.000Z',
                        'confidential': False,
                        'details': {
                            'applicationType': 'Operações Compromissadas',
                            'negotiationType': 'Para negociação',
                            'issueDate': '2024-01-17T00:00:00.000Z',
                            'relatedIssuer': False,
                            'fundClassType': 'CLASSES - FIF',
                        },
                    }
                ],
                'fundHoldings': [],
                'creditAssets': [],
                'listedSecurities': [],
                'receivables': [
                    {
                        'assetType': 'Valores a receber',
                        'assetName': 'RENDIMENTOS A RECEBER',
                        'marketValue': 12371910,
                        'confidential': False,
                        'details': {},
                    }
                ],
                'payables': [
                    {
                        'assetType': 'Valores a pagar',
                        'assetName': 'RENDIMENTOS A PAGAR',
                        'marketValue': 11913311,
                        'confidential': False,
                        'details': {},
                    }
                ],
                'confidentialSummary': None,
            }
        ]
    }


#: The routes a test does not care about, answering with their empty envelope.
EMPTY_ROUTES: dict[str, dict] = {
    'get_fund_nav_history': {'history': []},
    'get_fund_profile': {'profiles': []},
    'get_fund_portfolio': {'funds': []},
}


def _route(answer) -> AsyncMock:
    return (
        AsyncMock(side_effect=answer)
        if isinstance(answer, Exception)
        else AsyncMock(return_value=answer)
    )


def _provider(identity, indicators, dividends, **routes) -> MarketDataProvider:
    provider = MarketDataProvider()
    answers = {
        'list_funds': identity,
        'get_fund_indicators': indicators,
        'get_fund_dividends': dividends,
        **EMPTY_ROUTES,
        **routes,
    }
    for name, answer in answers.items():
        setattr(provider.brapi_client, name, _route(answer))
    return provider


def _full_provider(**routes) -> MarketDataProvider:
    """Every route answering, with the ones a test names replaced."""
    answers = {
        'list_funds': _identity_response(),
        'get_fund_indicators': _indicators_response(),
        'get_fund_dividends': _dividends_response(),
        'get_fund_nav_history': _nav_history_response(),
        'get_fund_profile': _regulatory_profile_response(),
        'get_fund_portfolio': _portfolio_response(),
        **routes,
    }
    return _provider(
        answers.pop('list_funds'),
        answers.pop('get_fund_indicators'),
        answers.pop('get_fund_dividends'),
        **answers,
    )


@pytest.mark.asyncio
async def test_provider_maps_the_documented_fund_payloads_onto_the_domain():
    provider = _full_provider()

    profile = await provider.fetch_investment_fund_profile(ticker='juro11')

    assert profile.ticker == TICKER
    assert profile.identity == InvestmentFundIdentity(
        cnpj=CNPJ,
        legal_name=LEGAL_NAME,
        kind='fiinfra',
        isin=None,
        cvm_class_type=None,
        cvm_classification=None,
        anbima_classification=None,
        b3_classification='Financeiro/Fundos/FI-INFRA',
        administrator_name=ADMINISTRATOR,
        administrator_cnpj=None,
        manager_name=None,
        manager_cnpj=None,
        status=None,
    )
    assert profile.indicators == InvestmentFundIndicators(
        as_of_date=date(2026, 6, 18),
        price=96.99,
        nav_per_share=NAV_PER_SHARE,
        price_to_nav=PRICE_TO_NAV,
        equity=EQUITY,
        total_assets=2041704100,
        shareholders=SHAREHOLDERS,
        daily_applications=0,
        daily_redemptions=0,
        shares_outstanding=None,
        monthly_return=None,
        patrimonial_monthly_return=None,
        dividend_yield_monthly=None,
    )
    assert profile.dividends == [
        InvestmentFundDividend(
            payment_date=date(2026, 5, 14),
            value_per_share=0.48,
            ex_date=date(2026, 4, 28),
            declared_date=date(2026, 4, 28),
            event_type='RENDIMENTO',
        ),
        InvestmentFundDividend(
            payment_date=date(2026, 6, 13),
            value_per_share=LAST_RATE,
            ex_date=date(2026, 5, 29),
            declared_date=date(2026, 5, 29),
            event_type='RENDIMENTO',
        ),
    ]


@pytest.mark.asyncio
async def test_ratios_and_multiples_reach_the_domain_unscaled():
    """P/VP is a multiple and a return is a ratio; neither is a percentage.

    Scaling either here would make the number mean something else upstream,
    and the client is what decides how each is written.
    """
    provider = _full_provider(
        get_fund_indicators=_indicators_response(
            monthlyReturn=0.0142,
            patrimonialMonthlyReturn=0.0138,
            dividendYieldMonthly=0.0051,
        )
    )

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.indicators.price_to_nav == PRICE_TO_NAV
    assert profile.indicators.monthly_return == 0.0142
    assert profile.indicators.patrimonial_monthly_return == 0.0138
    assert profile.indicators.dividend_yield_monthly == 0.0051


@pytest.mark.asyncio
async def test_each_route_is_asked_with_the_parameters_the_provider_documents():
    provider = _full_provider()

    await provider.fetch_investment_fund_profile(ticker='juro11')

    client = provider.brapi_client
    client.list_funds.assert_awaited_once_with(symbols=TICKER)
    client.get_fund_indicators.assert_awaited_once_with(symbols=TICKER)
    client.get_fund_nav_history.assert_awaited_once_with(
        symbols=TICKER, sortOrder='asc', limit=FUND_HISTORY_LIMIT
    )
    client.get_fund_dividends.assert_awaited_once_with(
        symbols=TICKER, sortOrder='asc', limit=FUND_HISTORY_LIMIT
    )
    # No reference date on either filing route: the answer is the most recent
    # one the fund has filed.
    client.get_fund_profile.assert_awaited_once_with(symbols=TICKER)
    client.get_fund_portfolio.assert_awaited_once_with(symbols=TICKER)


@pytest.mark.asyncio
async def test_the_share_value_series_arrives_oldest_first():
    provider = _full_provider()

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert [point.date for point in profile.nav_history] == [
        date(2026, 6, 17),
        date(2026, 6, 18),
    ]
    assert profile.nav_history[0] == InvestmentFundNavPoint(
        date=date(2026, 6, 17),
        class_or_series=None,
        nav_per_share=99.1,
        equity=2039000000,
        total_assets=2040000000,
        shareholders=92700,
        daily_applications=1500,
        daily_redemptions=0,
        monthly_return=None,
    )


@pytest.mark.asyncio
async def test_two_classes_of_the_same_fund_file_on_one_date_and_both_are_kept():
    """A FIDC files per class or series, so a date alone does not identify a row.

    Keying the series by date alone would drop one of the two classes and show
    a fund half its size, with nothing on screen saying so.
    """
    history = _nav_history_response()
    history['history'] = [
        {**history['history'][0], 'classOrSeries': 'Sênior', 'navPerShare': 120.0},
        {**history['history'][0], 'classOrSeries': 'Subordinada', 'navPerShare': 80.0},
    ]
    provider = _full_provider(get_fund_nav_history=history)

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    # Both survive, and the order among them on one date is only stable, not
    # meaningful: it is the code-point order of the class names.
    assert sorted(
        (point.class_or_series, point.nav_per_share) for point in profile.nav_history
    ) == [('Subordinada', 80.0), ('Sênior', 120.0)]
    assert {point.date for point in profile.nav_history} == {date(2026, 6, 18)}


@pytest.mark.asyncio
async def test_the_portfolio_buckets_become_one_list_that_names_its_own_group():
    """Six lists of one shape, flattened, with the group carried on each line.

    A payable is an obligation and a public bond is something owned. Losing the
    group would let a reader add the two up.
    """
    provider = _full_provider()

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.portfolio.reference_date == date(2026, 5, 31)
    assert profile.portfolio.summary.market_value == 2083851261
    assert profile.portfolio.summary.holdings_count == 7
    assert profile.portfolio.summary.payables_value == 11913311

    buckets = [holding.bucket for holding in profile.portfolio.holdings]
    assert buckets == ['public_bonds', 'receivables', 'payables']

    bond = profile.portfolio.holdings[0]
    assert bond.asset_name == 'NOTAS DO TESOURO NACIONAL SERIE B'
    assert bond.isin == 'BRSTNCNTB716'
    assert bond.selic_code == '760199'
    assert bond.quantity == 1434
    assert bond.market_value == PUBLIC_BOND_VALUE
    assert bond.maturity_date == date(2029, 5, 15)
    assert bond.confidential is False
    # Carried as filed: the keys vary by group and by fund, so promoting them
    # into fields would leave most rows with columns nobody fills.
    assert bond.details['applicationType'] == 'Operações Compromissadas'
    assert bond.details['fundClassType'] == 'CLASSES - FIF'


@pytest.mark.asyncio
async def test_the_regulatory_profile_carries_who_holds_the_fund_and_its_risk():
    provider = _full_provider()

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.regulatory_profile.reference_date == date(2026, 5, 31)
    assert profile.regulatory_profile.investors == InvestmentFundInvestorBreakdown(
        individual_retail=0,
        individual_retail_percent=0,
        legal_entities=0,
        legal_entities_percent=0,
        funds_or_clubs=1,
        funds_or_clubs_percent=100,
        non_residents=0,
        non_residents_percent=0,
        other=0,
        other_percent=0,
    )
    assert profile.regulatory_profile.risk == InvestmentFundRisk(
        risk_model='Modelos Não-Paramétricos',
        portfolio_var=0,
        daily_quota_variation_percent=0,
        stressed_daily_quota_variation_percent=0,
        private_credit_exposure_percent=0,
    )
    assert profile.regulatory_profile.top_investor_percent == 0
    assert profile.regulatory_profile.private_credit_exposure_percent == 0


@pytest.mark.asyncio
async def test_the_most_recent_regulatory_filing_is_the_one_read():
    """The route sorts without publishing by what, so the date decides."""
    answer = _regulatory_profile_response()
    older = {**answer['profiles'][0], 'referenceDate': '2026-04-30T00:00:00.000Z'}
    answer['profiles'] = [older, *answer['profiles']]
    provider = _full_provider(get_fund_profile=answer)

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.regulatory_profile.reference_date == date(2026, 5, 31)


@pytest.mark.asyncio
async def test_a_liquidity_section_the_provider_leaves_null_costs_nothing_else():
    """The whole section arrives null, not just its fields.

    Nothing here claims to know what it would contain, so a null one must not
    take the risk and investor figures filed beside it down with it.
    """
    answer = _regulatory_profile_response()
    answer['profiles'][0]['liquidity'] = None
    provider = _full_provider(get_fund_profile=answer)

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.regulatory_profile.risk.risk_model == 'Modelos Não-Paramétricos'
    assert profile.regulatory_profile.investors.funds_or_clubs == 1


@pytest.mark.asyncio
async def test_entries_of_other_funds_in_the_same_answer_are_left_out():
    """Every route answers a flat list that names each row's fund."""
    identity = _identity_response()
    identity['funds'].append({**identity['funds'][0], 'symbol': 'OTHER11', 'assetType': 'fiagro'})

    dividends = _dividends_response()
    dividends['dividends'].append({
        **dividends['dividends'][0],
        'symbol': 'OTHER11',
        'rate': 99.0,
    })

    history = _nav_history_response()
    history['history'].append({**history['history'][0], 'symbol': 'OTHER11', 'navPerShare': 1.0})

    provider = _full_provider(
        list_funds=identity,
        get_fund_dividends=dividends,
        get_fund_nav_history=history,
    )

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.identity.kind == 'fiinfra'
    assert [dividend.value_per_share for dividend in profile.dividends] == [0.48, LAST_RATE]
    assert all(point.nav_per_share != 1.0 for point in profile.nav_history)


@pytest.mark.asyncio
async def test_one_failing_route_does_not_cost_the_other_sections():
    provider = _full_provider(get_fund_portfolio=RuntimeError('the portfolio is down'))

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.portfolio is None
    assert profile.indicators.price_to_nav == PRICE_TO_NAV
    assert [dividend.value_per_share for dividend in profile.dividends] == [0.48, LAST_RATE]
    assert profile.regulatory_profile.reference_date == date(2026, 5, 31)


@pytest.mark.asyncio
async def test_every_route_failing_raises_rather_than_serving_an_empty_profile():
    """A spent quota refuses all six at once, and must reach the reader.

    A page of empty cards would say the provider covers this fund and has
    nothing on it, which is a different statement from being refused.
    """
    provider = _provider(
        IntegrationRateLimited(provider='brapi', status_code=429),
        RuntimeError('brapi is down'),
        RuntimeError('brapi is down'),
        **{name: RuntimeError('brapi is down') for name in EMPTY_ROUTES},
    )

    with pytest.raises(IntegrationRateLimited):
        await provider.fetch_investment_fund_profile(ticker=TICKER)


@pytest.mark.asyncio
async def test_a_figure_the_provider_omits_is_unknown_rather_than_zero():
    """These routes leave most figures blank for most fund kinds.

    A zero there would read as a fund whose equity or return is actually nil,
    which is a different statement from one the provider does not publish.
    """
    response = _indicators_response()
    del response['funds'][0]['priceToNav']
    del response['funds'][0]['totalInvestors']
    response['funds'][0]['equity'] = None
    provider = _full_provider(get_fund_indicators=response)

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.indicators.price_to_nav is None
    assert profile.indicators.shareholders is None
    assert profile.indicators.equity is None
    assert profile.indicators.price == 96.99


@pytest.mark.asyncio
async def test_a_fund_the_provider_has_nothing_on_has_no_registration_section():
    """An object of thirteen empty fields would still draw the section."""
    provider = _full_provider(list_funds={'funds': [{'symbol': TICKER}]})

    profile = await provider.fetch_investment_fund_profile(ticker=TICKER)

    assert profile.identity is None


@pytest.mark.asyncio
async def test_the_catalogue_leaves_out_real_estate_funds_and_etfs():
    """The listing route answers for every fund it knows, those two included.

    The filter is on the kind the provider states and never on the ticker: a
    code ending in 11 says nothing about which of them a fund is, and JURO11 is
    an FI-Infra.
    """
    provider = MarketDataProvider()
    provider.brapi_client.list_funds = AsyncMock(
        return_value={
            'funds': [
                {'symbol': TICKER, 'assetType': 'fiinfra'},
                {'symbol': 'MXRF11', 'assetType': 'fii'},
                {'symbol': 'BOVA11', 'assetType': 'ETF'},
                {'symbol': 'CPTR11', 'assetType': 'fiagro'},
                {'symbol': 'XPTO11', 'assetType': None},
            ]
        }
    )

    funds = await provider.fetch_investment_fund_market()

    assert [fund['symbol'] for fund in funds] == [TICKER, 'CPTR11', 'XPTO11']
    provider.brapi_client.list_funds.assert_awaited_once_with(
        page=1, limit=FUND_HISTORY_LIMIT, sortBy='symbol', sortOrder='asc'
    )


def _service(asset, provider) -> InvestmentFundProfileReadService:
    return InvestmentFundProfileReadService(
        uow=FakeUnitOfWork(
            assets=SimpleNamespace(get_by_ids=AsyncMock(return_value=[asset] if asset else []))
        ),
        provider=provider,
        cache=FakeCache(),
    )


@pytest.mark.asyncio
async def test_profile_read_resolves_the_registered_asset_before_asking_the_provider():
    provider = _full_provider()
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.FI),
        provider,
    )

    profile = await service.get_profile(asset_id=ASSET_ID)

    provider.brapi_client.get_fund_indicators.assert_awaited_once_with(symbols=TICKER)
    assert profile['ticker'] == TICKER
    assert profile['identity']['kind'] == 'fiinfra'
    assert profile['indicators']['price_to_nav'] == PRICE_TO_NAV
    assert profile['dividends'][-1] == {
        'payment_date': '2026-06-13',
        'ex_date': '2026-05-29',
        'declared_date': '2026-05-29',
        'value_per_share': LAST_RATE,
        'event_type': 'RENDIMENTO',
    }


@pytest.mark.asyncio
async def test_the_served_profile_is_json_and_dates_it_carries_are_strings():
    """The cache holds it as JSON, so a date that stayed a date would fail it."""
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.FI),
        _full_provider(),
    )

    profile = await service.get_profile(asset_id=ASSET_ID)

    assert profile['nav_history'][0]['date'] == '2026-06-17'
    assert profile['portfolio']['reference_date'] == '2026-05-31'
    assert profile['portfolio']['holdings'][0]['maturity_date'] == '2029-05-15'
    assert profile['regulatory_profile']['reference_date'] == '2026-05-31'


@pytest.mark.asyncio
async def test_a_second_read_of_the_same_fund_is_served_from_the_cache():
    provider = _full_provider()
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.FI),
        provider,
    )

    first = await service.get_profile(asset_id=ASSET_ID)
    second = await service.get_profile(asset_id=ASSET_ID)

    assert first == second
    provider.brapi_client.get_fund_indicators.assert_awaited_once()


@pytest.mark.asyncio
async def test_profile_read_refuses_a_real_estate_fund():
    """A FII has a profile of its own, built from buildings and vacancy.

    Serving it from here would answer with a page of empty sections instead of
    the one that fits it.
    """
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker='MXRF11', asset_type_id=ASSET_TYPE.FII),
        _full_provider(),
    )

    with pytest.raises(ValidationError):
        await service.get_profile(asset_id=ASSET_ID)


@pytest.mark.asyncio
async def test_profile_read_reports_an_unknown_asset():
    service = _service(None, _full_provider())

    with pytest.raises(NotFoundError):
        await service.get_profile(asset_id=ASSET_ID)


@pytest.mark.asyncio
async def test_the_catalogue_carries_the_id_of_a_fund_registered_in_the_app():
    """A row can only open a page for a fund the application knows.

    The rest of the catalogue is still readable, which is the point of serving
    the whole universe rather than only what is registered.
    """
    provider = MarketDataProvider()
    provider.brapi_client.list_funds = AsyncMock(
        return_value={
            'funds': [
                {
                    'symbol': TICKER,
                    'name': 'SPARTA INFRA',
                    'cnpj': CNPJ,
                    'assetType': 'FIINFRA',
                    'b3Classification': 'Financeiro/Fundos/FI-INFRA',
                    'administratorName': ADMINISTRATOR,
                    'price': 96.99,
                    'navPerShare': NAV_PER_SHARE,
                    'priceToNav': PRICE_TO_NAV,
                    'equity': EQUITY,
                    'totalInvestors': SHAREHOLDERS,
                },
                {'symbol': 'CPTR11', 'name': 'CAPITANIA AGRO', 'assetType': 'fiagro'},
            ]
        }
    )
    service = InvestmentFundMarketReadService(
        uow=FakeUnitOfWork(
            assets=SimpleNamespace(
                get_by_tickers=AsyncMock(return_value=[SimpleNamespace(id=ASSET_ID, ticker=TICKER)])
            )
        ),
        provider=provider,
        cache=FakeCache(),
    )

    market = await service.list_market()

    assert market['total'] == 2
    assert market['funds'][0]['asset_id'] == ASSET_ID
    # Lower-cased on the way in, so the screen names one kind and not two.
    assert market['funds'][0]['kind'] == 'fiinfra'
    assert market['funds'][0]['price_to_nav'] == PRICE_TO_NAV
    assert market['funds'][0]['investors'] == SHAREHOLDERS
    assert market['funds'][1]['asset_id'] is None
    assert market['funds'][1]['price'] is None
