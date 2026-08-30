"""The listed-company profile, checked against brapi's observed payloads.

The field names and the envelopes below are the provider's, taken from live
answers for the nine routes one profile is read from. They are the contract
this adapter exists to translate, so a rename upstream should fail here rather
than quietly empty a card.

Two of the cases are about facts the provider's documentation does not state
and only a live answer showed:

- the statement routes return **every line any Brazilian filer might report**,
  which is 128 for the balance sheet, and any one company leaves most of them
  null -- Petrobras fills 65 and Itaú fills 31, with 16 in common. That is why
  a statement point carries a mapping of the lines that came, and why
  ``test_a_statement_carries_only_the_lines_the_company_filed`` exists;
- three date formats and two percentage conventions arrive in the same profile,
  and both are normalized at the door rather than on screen.
"""

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.service.stock_service import StockProfileReadService
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 77
TICKER = 'PETR4'
RENAMED_FROM = 'VVAR3'
RENAMED_TO = 'BHIA3'
PRICE = 43.55
WEEK_LOW = 29.31
WEEK_HIGH = 50.69
TRAILING_PE = 4.662618
PRICE_TO_BOOK = 1.1670742
DIVIDEND_YIELD = 0.08
RETURN_ON_EQUITY = 0.2781079
PROFIT_MARGIN = 0.2438609
QUARTER_REVENUE = 169_500_000_000.0


def _envelope(data, *, requested: str = TICKER, symbol: str | None = None) -> dict:
    """The shape every `/v2/stocks/*` route answers with.

    ``requestedSymbol`` is what was asked for and ``symbol`` is what the market
    calls it now; the two differ after a rename, and matching on the wrong one
    is the mistake this envelope exists to make visible.
    """
    return {
        'results': [
            {
                'requestedSymbol': requested,
                'symbol': symbol or requested,
                'changed': bool(symbol and symbol != requested),
                'data': data,
            }
        ],
        'requestedAt': '2026-08-30T14:45:07.000Z',
        'took': 286,
    }


def _quote_response(**overrides) -> dict:
    """`/v2/stocks/quote`: the price now and the band the year drew."""
    data = {
        'shortName': 'PETR4',
        'longName': 'Petroleo Brasileiro SA Pfd',
        'currency': 'BRL',
        'regularMarketPrice': PRICE,
        'regularMarketDayHigh': 43.6,
        'regularMarketDayLow': 42.62,
        'regularMarketDayRange': '42.62 - 43.6',
        'regularMarketChange': 0.85,
        # Pontos percentuais nesta rota, e só nesta.
        'regularMarketChangePercent': 1.99,
        'regularMarketTime': '2026-08-30T14:45:07.000Z',
        'marketCap': 590393380664,
        'regularMarketVolume': 46135600,
        'regularMarketPreviousClose': 43.53,
        'regularMarketOpen': 42.72,
        'fiftyTwoWeekRange': '29.31 - 50.69',
        'fiftyTwoWeekLow': WEEK_LOW,
        'fiftyTwoWeekHigh': WEEK_HIGH,
        'logourl': 'https://icons.brapi.dev/icons/PETR4.svg',
        **overrides,
    }
    return _envelope(data)


def _company_response(**overrides) -> dict:
    """`/v2/stocks/profile`: the business, and the registrar block it never fills."""
    data = {
        'address1': None,
        'city': None,
        'state': None,
        'country': None,
        'website': 'https://petrobras.com.br',
        'industry': 'Petróleo e Gás Integrado',
        'industryKey': 'petroleo-e-gas-integrado',
        'industryDisp': 'Petróleo e Gás Integrado',
        'sector': 'Energia',
        'sectorKey': 'energia',
        'sectorDisp': 'Energia',
        'longBusinessSummary': 'Primeiro parágrafo.\n\nSegundo parágrafo.\n\nTerceiro.',
        'fullTimeEmployees': 41778,
        'companyOfficers': None,
        'name': None,
        'startDate': '1953-10-03',
        'logoUrl': 'https://icons.brapi.dev/icons/PETR4.svg',
        'cnpj': '33000167000101',
        'administratorName': None,
        'administratorCnpj': None,
        'administratorWebsite': None,
        **overrides,
    }
    return _envelope(data)


def _statistics_response(**overrides) -> dict:
    """`/v2/stocks/statistics`: multiples, as fractions and never as points."""
    data = {
        'marketCap': 561304300000,
        'enterpriseValue': 1183823300000,
        'trailingPE': TRAILING_PE,
        'forwardPE': None,
        'priceToBook': PRICE_TO_BOOK,
        'bookValue': 37.315536,
        'trailingEps': 10.348263,
        'forwardEps': None,
        'pegRatio': 0.065309554,
        'beta': 0.3279574,
        'dividendYield': DIVIDEND_YIELD,
        'yield': DIVIDEND_YIELD,
        'profitMargins': PROFIT_MARGIN,
        'netIncomeToCommon': 133376000000,
        'earningsQuarterlyGrowth': 0.9606708,
        'enterpriseToRevenue': 2.15832,
        'enterpriseToEbitda': 4.3312244,
        'sharesOutstanding': 12888733000,
        'floatShares': 4410960400,
        '52WeekChange': 0.54984826,
        'mostRecentQuarter': '2026-06-30',
        # O formato Postgres, com espaço, que convive com ISO no mesmo objeto.
        'nextFiscalYearEnd': '2026-12-31 00:00:00+00',
        'lastDividendValue': None,
        'lastDividendDate': '2026-08-21',
        # O bloco de fundo e o short interest, que nunca são preenchidos aqui.
        'fundFamily': None,
        'morningStarOverallRating': None,
        'sharesShort': None,
        'heldPercentInstitutions': None,
        **overrides,
    }
    return _envelope(data)


def _fundamentals_response(**overrides) -> dict:
    """`/v2/stocks/financial-data`: the business, and the analyst block it never fills."""
    data = {
        'totalRevenue': 548493000000,
        'grossProfits': 277512000000,
        'ebitda': 273323000000,
        'totalCash': 53764000000,
        'totalCashPerShare': 4.1713953,
        'totalDebt': 676283000000,
        'debtToEquity': 1.40614,
        'quickRatio': 0.57706815,
        'currentRatio': 0.8544373,
        'returnOnAssets': 0.10457702,
        'returnOnEquity': RETURN_ON_EQUITY,
        'freeCashflow': 85795000000,
        'operatingCashflow': 214359000000,
        'grossMargins': 0.5059536,
        'ebitdaMargins': 0.4983163,
        'operatingMargins': 0.3386479,
        'profitMargins': PROFIT_MARGIN,
        'earningsGrowth': 0.7139259,
        'revenueGrowth': 0.11228661,
        'earningsGrowthAnnual': 2.0084958,
        'revenueGrowthAnnual': 0.013691123,
        'targetMeanPrice': None,
        'recommendationKey': None,
        'numberOfAnalystOpinions': None,
        **overrides,
    }
    return _envelope(data)


def _dividends_response(**overrides) -> dict:
    """`/v2/stocks/dividends`: three lists, three shapes."""
    data = {
        'cashDividends': [
            {
                'assetIssued': 'BRPETRACNPR6',
                'paymentDate': '2026-05-20T03:00:00.000Z',
                'rate': 0.32,
                'relatedTo': '1º trimestre',
                'approvedOn': '2026-04-10T03:00:00.000Z',
                'isinCode': 'BRPETRACNPR6',
                'label': 'JCP',
                'lastDatePrior': '2026-04-25T03:00:00.000Z',
                'remarks': '',
            },
            {
                'assetIssued': 'BRPETRACNPR6',
                # Anunciado para o futuro, que é o normal e não um erro.
                'paymentDate': '2026-12-21T03:00:00.000Z',
                'rate': 0.471567,
                'relatedTo': '',
                'approvedOn': None,
                'isinCode': 'BRPETRACNPR6',
                'label': 'DIVIDENDO',
                'lastDatePrior': '2026-08-21T03:00:00.000Z',
                'remarks': '',
            },
        ],
        'stockDividends': [
            {
                'assetIssued': 'BRPETRACNPR6',
                'factor': 2,
                'completeFactor': '2 para 1',
                'approvedOn': '2008-04-25T03:00:00.000Z',
                'isinCode': 'BRPETRACNPR6',
                'label': 'DESDOBRAMENTO',
                'lastDatePrior': '2008-04-25T03:00:00.000Z',
                'remarks': '',
            }
        ],
        'subscriptions': [],
        **overrides,
    }
    return _envelope(data)


def _income_statement_response(points=None) -> dict:
    """`/v2/stocks/income-statement`: newest first, and mostly null by design."""
    return _envelope(
        points
        if points is not None
        else [
            {
                'type': 'quarterly',
                'endDate': '2026-06-30',
                'totalRevenue': QUARTER_REVENUE,
                'netIncome': 52500000000,
                'grossProfit': 85000000000,
                # As linhas de banco e de seguradora, que uma petroleira não
                # preenche e que a rota manda assim mesmo.
                'reinsuranceOperations': None,
                'claimsAndOperationsCosts': None,
                'complementaryPensionOperations': None,
            },
            {
                'type': 'quarterly',
                'endDate': '2026-03-31',
                'totalRevenue': 123700000000,
                'netIncome': 32800000000,
                'grossProfit': 61000000000,
                'reinsuranceOperations': None,
                'claimsAndOperationsCosts': None,
                'complementaryPensionOperations': None,
            },
        ]
    )


EMPTY_STATEMENT_ROUTES = {
    'get_stock_balance_sheet': _envelope([]),
    'get_stock_cash_flow': _envelope([]),
    'get_stock_value_added': _envelope([]),
}


def _route(answer) -> AsyncMock:
    return (
        AsyncMock(side_effect=answer)
        if isinstance(answer, Exception)
        else AsyncMock(return_value=answer)
    )


def _provider(**routes) -> MarketDataProvider:
    """Every route answering, with the ones a test names replaced."""
    provider = MarketDataProvider()
    answers = {
        'get_stock_quotes': _quote_response(),
        'get_stock_profile': _company_response(),
        'get_stock_statistics': _statistics_response(),
        'get_stock_financial_data': _fundamentals_response(),
        'get_stock_dividends': _dividends_response(),
        'get_stock_income_statement': _income_statement_response(),
        **EMPTY_STATEMENT_ROUTES,
        **routes,
    }
    for name, answer in answers.items():
        setattr(provider.brapi_client, name, _route(answer))
    return provider


@pytest.mark.asyncio
async def test_provider_maps_the_observed_stock_payloads_onto_the_domain():
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.ticker == TICKER
    assert profile.company.sector == 'Energia'
    assert profile.company.sector_key == 'energia'
    assert profile.company.employees == 41778
    assert profile.company.founded_on == date(1953, 10, 3)
    assert profile.price_range.price == PRICE
    assert profile.price_range.fifty_two_week_low == WEEK_LOW
    assert profile.price_range.fifty_two_week_high == WEEK_HIGH
    assert profile.statistics.trailing_pe == TRAILING_PE
    assert profile.statistics.price_to_book == PRICE_TO_BOOK
    assert profile.fundamentals.return_on_equity == RETURN_ON_EQUITY


@pytest.mark.asyncio
async def test_the_daily_change_becomes_a_ratio_like_every_other_proportion():
    """Two conventions arrive; one leaves.

    The quote route states the day in percentage points and the statistics and
    financial-data routes state their proportions as fractions. Letting both
    through would leave the screen to remember which is which, and a formatter
    that scales a number already scaled writes 199% where there is 1,99%.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.price_range.day_change == pytest.approx(0.0199)
    assert profile.statistics.dividend_yield == DIVIDEND_YIELD
    assert profile.fundamentals.profit_margin == PROFIT_MARGIN


@pytest.mark.asyncio
async def test_the_three_date_formats_in_one_profile_all_become_dates():
    """ISO, bare day and the Postgres-style string, which arrive together.

    ``mostRecentQuarter`` is ``2026-06-30``, ``lastDividendDate`` is a bare day,
    a payment date is a full ISO instant, and ``nextFiscalYearEnd`` is
    ``2026-12-31 00:00:00+00``. One parser reads all of them, and this is what
    says so.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.statistics.most_recent_quarter == date(2026, 6, 30)
    assert profile.statistics.last_dividend_date == date(2026, 8, 21)
    assert profile.cash_dividends[0].payment_date == date(2026, 5, 20)
    assert MarketDataProvider._provider_date('2026-12-31 00:00:00+00') == date(2026, 12, 31)


@pytest.mark.asyncio
async def test_a_renamed_ticker_is_matched_by_what_was_asked_for():
    """The provider resolves a rename on the way out, and the row must still be found.

    Asking for VVAR3 answers under BHIA3. Matching on the answer would find
    nothing for the code the portfolio holds, and the page would come back empty
    for a company that is very much still listed.
    """
    quote = _quote_response()['results'][0]['data']
    provider = _provider(
        get_stock_quotes=_envelope(quote, requested=RENAMED_FROM, symbol=RENAMED_TO),
        **{
            name: _envelope([], requested=RENAMED_FROM, symbol=RENAMED_TO)
            for name in (
                'get_stock_profile',
                'get_stock_statistics',
                'get_stock_financial_data',
                'get_stock_dividends',
                'get_stock_income_statement',
                'get_stock_balance_sheet',
                'get_stock_cash_flow',
                'get_stock_value_added',
            )
        },
    )

    profile = await provider.fetch_stock_profile(ticker=RENAMED_FROM)

    assert profile.ticker == RENAMED_FROM
    assert profile.resolved_ticker == RENAMED_TO
    assert profile.renamed is True
    assert profile.price_range.price == PRICE


@pytest.mark.asyncio
async def test_a_ticker_that_was_not_renamed_says_so():
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.resolved_ticker == TICKER
    assert profile.renamed is False


@pytest.mark.asyncio
async def test_a_statement_carries_only_the_lines_the_company_filed():
    """The empty lines never reach the contract.

    The route answers with every line any Brazilian filer might report, so an
    oil company receives a bank's and an insurer's as nulls. Carrying them would
    put a hundred always-empty fields into the API and the client type; dropping
    them keeps a filer's statement to a filer's own lines.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    latest = profile.income_statement[-1]
    assert latest.lines['total_revenue'] == QUARTER_REVENUE
    assert 'reinsurance_operations' not in latest.lines
    assert 'claims_and_operations_costs' not in latest.lines
    # O período e a data são o cabeçalho do ponto, e não linhas dele.
    assert 'type' not in latest.lines
    assert 'end_date' not in latest.lines
    assert latest.period == 'quarterly'


@pytest.mark.asyncio
async def test_a_statement_series_arrives_oldest_first():
    """The route answers newest first and a chart wants the other order.

    Reversing once here is cheaper than every reader remembering to, and a
    series drawn in the answered order runs backwards in time without ever
    looking wrong.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert [point.end_date for point in profile.income_statement] == [
        date(2026, 3, 31),
        date(2026, 6, 30),
    ]


@pytest.mark.asyncio
async def test_the_three_kinds_of_payment_stay_three_lists():
    """Money, shares and a subscription right are not one thing.

    A cash dividend has an amount and a payment date; a bonus issue has a
    proportion and neither. Folded into one list, every consumer would have to
    ask what it is holding before reading any field -- and a reader adding up
    income would add a split into it.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert [payment.label for payment in profile.cash_dividends] == ['JCP', 'DIVIDENDO']
    assert profile.cash_dividends[0].value_per_share == 0.32
    assert [event.label for event in profile.share_dividends] == ['DESDOBRAMENTO']
    assert profile.share_dividends[0].complete_factor == '2 para 1'
    assert profile.subscriptions == []


@pytest.mark.asyncio
async def test_a_payment_announced_for_the_future_is_kept():
    """A company announces months ahead, and that is not a stale row.

    Dropping anything dated after today would hide the payment a reader is most
    likely to be looking for.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.cash_dividends[-1].payment_date == date(2026, 12, 21)


@pytest.mark.asyncio
async def test_the_registrar_and_analyst_blocks_never_reach_the_domain():
    """Two blocks the routes carry and Brazil never fills.

    The registrar block only means something for a fund and the analyst
    consensus is uncovered here, so both are always null. A card built on them
    would be a card that never fills, and a reader learns to skip the row it
    sits in.
    """
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert not hasattr(profile.company, 'administrator_name')
    assert not hasattr(profile.fundamentals, 'target_mean_price')
    assert not hasattr(profile.statistics, 'fund_family')
    assert not hasattr(profile.statistics, 'shares_short')


@pytest.mark.asyncio
async def test_the_summary_keeps_the_paragraphs_the_company_wrote():
    profile = await _provider().fetch_stock_profile(ticker=TICKER)

    assert profile.company.summary_paragraphs == [
        'Primeiro parágrafo.',
        'Segundo parágrafo.',
        'Terceiro.',
    ]


@pytest.mark.asyncio
async def test_one_failing_route_does_not_cost_the_other_sections():
    provider = _provider(get_stock_statistics=RuntimeError('statistics down'))

    profile = await provider.fetch_stock_profile(ticker=TICKER)

    assert profile.statistics is None
    assert profile.fundamentals is not None
    assert profile.company is not None
    assert profile.income_statement


@pytest.mark.asyncio
async def test_every_route_failing_raises_rather_than_serving_an_empty_profile():
    """All nine refusing is a token or a spent quota, not nine empty sections."""
    failure = RuntimeError('quota spent')
    provider = _provider(
        **dict.fromkeys(
            (
                'get_stock_quotes',
                'get_stock_profile',
                'get_stock_statistics',
                'get_stock_financial_data',
                'get_stock_dividends',
                'get_stock_income_statement',
                'get_stock_balance_sheet',
                'get_stock_cash_flow',
                'get_stock_value_added',
            ),
            failure,
        )
    )

    with pytest.raises(RuntimeError, match='quota spent'):
        await provider.fetch_stock_profile(ticker=TICKER)


@pytest.mark.asyncio
async def test_a_figure_the_provider_omits_is_unknown_rather_than_zero():
    provider = _provider(
        get_stock_statistics=_statistics_response(trailingPE=None, priceToBook=None)
    )

    profile = await provider.fetch_stock_profile(ticker=TICKER)

    assert profile.statistics.trailing_pe is None
    assert profile.statistics.price_to_book is None


@pytest.mark.asyncio
async def test_a_company_the_provider_has_nothing_on_has_no_sections():
    provider = _provider(
        get_stock_profile=_envelope({}),
        get_stock_statistics=_envelope({}),
        get_stock_financial_data=_envelope({}),
    )

    profile = await provider.fetch_stock_profile(ticker=TICKER)

    assert profile.company is None
    assert profile.statistics is None
    assert profile.fundamentals is None


@pytest.mark.asyncio
async def test_the_value_added_statement_is_asked_for_by_the_year():
    """The DVA is an annual filing, and asking for it by quarter answers nothing."""
    provider = _provider()

    await provider.fetch_stock_profile(ticker=TICKER)

    provider.brapi_client.get_stock_value_added.assert_awaited_once_with(
        symbols=TICKER, mode='history', period='annual'
    )
    provider.brapi_client.get_stock_income_statement.assert_awaited_once_with(
        symbols=TICKER, mode='history', period='quarterly'
    )


@pytest.mark.asyncio
async def test_the_daily_history_is_not_among_the_routes():
    """The chart is drawn from the quotes this application ingests.

    Asking the provider for the same series again would be a second source for
    one number, and the two would disagree the first time an ingestion lagged.
    """
    provider = _provider()
    provider.brapi_client.get_stock_historical = _route(_envelope({}))

    await provider.fetch_stock_profile(ticker=TICKER)

    provider.brapi_client.get_stock_historical.assert_not_awaited()


def _service(asset, provider) -> StockProfileReadService:
    return StockProfileReadService(
        uow=FakeUnitOfWork(
            assets=SimpleNamespace(get_by_ids=AsyncMock(return_value=[asset] if asset else []))
        ),
        provider=provider,
        cache=FakeCache(),
    )


@pytest.mark.asyncio
async def test_profile_read_resolves_the_registered_asset_before_asking_the_provider():
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.STOCK),
        _provider(),
    )

    profile = await service.get_profile(asset_id=ASSET_ID)

    assert profile['ticker'] == TICKER
    assert profile['company']['sector'] == 'Energia'


@pytest.mark.asyncio
async def test_the_served_profile_is_json_and_dates_it_carries_are_strings():
    """It is cached as JSON, so nothing in it may be a date object."""
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.STOCK),
        _provider(),
    )

    profile = await service.get_profile(asset_id=ASSET_ID)

    assert profile['statistics']['most_recent_quarter'] == '2026-06-30'
    assert profile['income_statement'][-1]['end_date'] == '2026-06-30'
    assert profile['company']['founded_on'] == '1953-10-03'


@pytest.mark.asyncio
async def test_a_second_read_of_the_same_company_is_served_from_the_cache():
    """Nine routes per page open is exactly what the cache is here to prevent."""
    provider = _provider()
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=TICKER, asset_type_id=ASSET_TYPE.STOCK),
        provider,
    )

    await service.get_profile(asset_id=ASSET_ID)
    await service.get_profile(asset_id=ASSET_ID)

    provider.brapi_client.get_stock_quotes.assert_awaited_once()


@pytest.mark.asyncio
async def test_profile_read_refuses_an_asset_that_is_not_a_stock():
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker='BTLG11', asset_type_id=ASSET_TYPE.FII),
        _provider(),
    )

    with pytest.raises(ValidationError):
        await service.get_profile(asset_id=ASSET_ID)


@pytest.mark.asyncio
async def test_profile_read_reports_an_unknown_asset():
    service = _service(None, _provider())

    with pytest.raises(NotFoundError):
        await service.get_profile(asset_id=ASSET_ID)


@pytest.mark.asyncio
async def test_profile_read_refuses_an_asset_without_a_ticker():
    service = _service(
        SimpleNamespace(id=ASSET_ID, ticker=None, asset_type_id=ASSET_TYPE.STOCK),
        _provider(),
    )

    with pytest.raises(ValidationError):
        await service.get_profile(asset_id=ASSET_ID)
