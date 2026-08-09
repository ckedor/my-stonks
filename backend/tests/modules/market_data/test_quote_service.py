import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.constants import ASSET_TYPE
from app.infra.integrations.brapi_client import BrapiClient
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.quote import (
    AssetSnapshot,
    FetchedQuotes,
    Quote,
)
from tests.fakes import FakeUnitOfWork
from app.modules.market_data.service.quote_service import (
    QuoteService,
)

EXPECTED_ADJUSTED_CLOSE = 34.5
EXPECTED_PARALLEL_ASSETS = 4
EXPECTED_MAX_CONCURRENCY = 2
EXPECTED_UOW_COUNT_ON_PERSISTENCE_FAILURE = 3


def build_service(
    *,
    latest_dates: dict[int, date],
    fetched: FetchedQuotes,
    assets: list[AssetSnapshot] | None = None,
    max_concurrent_requests: int = 5,
):
    quote_repository = SimpleNamespace(
        get_latest_quote_dates=AsyncMock(return_value=latest_dates),
        upsert_quotes=AsyncMock(),
    )
    resolved_assets = assets or [
        AssetSnapshot(id=10, ticker='PETR4', asset_type_id=ASSET_TYPE.STOCK)
    ]
    database_assets = [
        SimpleNamespace(
            id=asset.id,
            ticker=asset.ticker,
            asset_type_id=asset.asset_type_id,
            exchange=SimpleNamespace(code=asset.exchange) if asset.exchange else None,
        )
        for asset in resolved_assets
    ]
    asset_repository = SimpleNamespace(
        get_by_ids=AsyncMock(
            side_effect=lambda ids: [asset for asset in database_assets if asset.id in ids]
        ),
        get_by_tickers=AsyncMock(
            side_effect=lambda tickers, asset_type_id: [
                asset
                for asset in database_assets
                if asset.ticker in tickers and asset.asset_type_id == asset_type_id
            ]
        ),
    )
    exit_errors = []
    created_uows = []

    def uow_factory():
        uow = FakeUnitOfWork(assets=asset_repository, quotes=quote_repository)
        uow.exit_errors = exit_errors
        created_uows.append(uow)
        return uow

    provider = SimpleNamespace(
        quote_source='test-provider',
        fetch_quotes=AsyncMock(return_value=fetched),
    )
    service = QuoteService(
        uow_factory=uow_factory,
        provider=provider,
        cache=SimpleNamespace(
            get_json=AsyncMock(return_value=None),
            set_json=AsyncMock(),
        ),
        max_concurrent_requests=max_concurrent_requests,
        today=lambda: date(2025, 2, 10),
    )
    return SimpleNamespace(
        service=service,
        exit_errors=exit_errors,
        created_uows=created_uows,
        quote_repository=quote_repository,
        provider=provider,
    )


@pytest.mark.asyncio
async def test_incremental_ingestion_requests_only_recent_window_when_history_is_empty():
    fetched = FetchedQuotes(
        ticker='PETR4',
        currency='BRL',
        source='test-provider',
        parameters={'range': 'max'},
        quotes=[Quote(date=date(2025, 1, 2), close=35.0)],
    )
    harness = build_service(latest_dates={}, fetched=fetched)

    result = await harness.service.ingest_quotes(asset_ids=[10])

    harness.provider.fetch_quotes.assert_awaited_once_with(
        ticker='PETR4',
        asset_type_id=ASSET_TYPE.STOCK,
        start_date=date(2025, 2, 3),
        exchange=None,
    )
    assert result.succeeded_assets == 1
    rows = harness.quote_repository.upsert_quotes.await_args.args[0]
    assert rows[0]['date'] == date(2025, 1, 2)
    assert rows[0]['source'] == 'test-provider'


@pytest.mark.asyncio
async def test_incremental_ingestion_overlaps_latest_date_by_seven_days():
    fetched = FetchedQuotes(
        ticker='PETR4',
        currency='BRL',
        source='test-provider',
        parameters={},
        quotes=[Quote(date=date(2025, 2, 1), close=36.0)],
    )
    harness = build_service(latest_dates={10: date(2025, 2, 8)}, fetched=fetched)

    await harness.service.ingest_quotes(asset_ids=[10])

    assert harness.provider.fetch_quotes.await_args.kwargs['start_date'] == date(2025, 2, 1)


@pytest.mark.asyncio
async def test_full_history_ingestion_ignores_latest_date():
    fetched = FetchedQuotes(
        ticker='PETR4',
        currency='BRL',
        source='test-provider',
        parameters={},
        quotes=[Quote(date=date(2025, 2, 1), close=36.0)],
    )
    harness = build_service(latest_dates={10: date(2025, 2, 8)}, fetched=fetched)

    await harness.service.ingest_quotes(
        asset_ids=[10],
        force_full_history=True,
    )

    assert harness.provider.fetch_quotes.await_args.kwargs['start_date'] is None


@pytest.mark.asyncio
async def test_provider_fetches_run_in_parallel_with_bounded_concurrency():
    active_requests = 0
    peak_requests = 0

    async def fetch_in_parallel(**kwargs):
        nonlocal active_requests, peak_requests
        active_requests += 1
        peak_requests = max(peak_requests, active_requests)
        await asyncio.sleep(0.01)
        active_requests -= 1
        return FetchedQuotes(
            ticker=kwargs['ticker'],
            currency='BRL',
            source='test-provider',
            parameters={},
            quotes=[Quote(date=date(2025, 2, 10), close=10.0)],
        )

    assets = [
        AssetSnapshot(id=index, ticker=f'ASSET{index}', asset_type_id=ASSET_TYPE.STOCK)
        for index in range(1, 5)
    ]
    harness = build_service(
        latest_dates={},
        fetched=FetchedQuotes(
            ticker='unused',
            currency='BRL',
            source='test-provider',
            parameters={},
        ),
        assets=assets,
        max_concurrent_requests=EXPECTED_MAX_CONCURRENCY,
    )
    harness.provider.fetch_quotes.side_effect = fetch_in_parallel

    result = await harness.service.ingest_quotes(asset_ids=[1, 2, 3, 4])

    assert result.succeeded_assets == EXPECTED_PARALLEL_ASSETS
    assert peak_requests == EXPECTED_MAX_CONCURRENCY
    assert harness.provider.fetch_quotes.await_count == EXPECTED_PARALLEL_ASSETS


@pytest.mark.asyncio
async def test_persistence_failure_is_reported_and_committed_as_failure():
    fetched = FetchedQuotes(
        ticker='PETR4',
        currency='BRL',
        source='test-provider',
        parameters={},
        quotes=[Quote(date=date(2025, 2, 10), close=10.0)],
    )
    harness = build_service(latest_dates={}, fetched=fetched)
    harness.quote_repository.upsert_quotes.side_effect = RuntimeError('database unavailable')

    result = await harness.service.ingest_quotes(asset_ids=[10])

    assert result.failed_assets == 1
    assert result.assets[0].error == 'database unavailable'
    assert harness.exit_errors == [None, RuntimeError, None]
    assert (
        len({id(uow) for uow in harness.created_uows}) == EXPECTED_UOW_COUNT_ON_PERSISTENCE_FAILURE
    )


@pytest.mark.asyncio
async def test_asset_lookup_falls_back_to_database_when_cache_is_unavailable():
    service = QuoteService(
        uow_factory=AsyncMock(),
        provider=SimpleNamespace(),
        cache=SimpleNamespace(
            get_json=AsyncMock(side_effect=ConnectionError('redis unavailable')),
            set_json=AsyncMock(side_effect=ConnectionError('redis unavailable')),
        ),
    )
    asset = SimpleNamespace(
        id=10,
        ticker='PETR4',
        asset_type_id=ASSET_TYPE.STOCK,
        exchange=SimpleNamespace(code='B3'),
    )
    asset_repo = SimpleNamespace(get_by_ids=AsyncMock(return_value=[asset]))

    assets, missing = await service._resolve_assets(
        asset_repo=asset_repo,
        asset_ids=[10],
        tickers=None,
        asset_type_id=None,
    )

    assert missing == []
    assert assets == [
        AssetSnapshot(
            id=10,
            ticker='PETR4',
            asset_type_id=ASSET_TYPE.STOCK,
            exchange='B3',
        )
    ]


@pytest.mark.asyncio
async def test_stock_provider_normalizes_response_without_filling_dates():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.brapi_client = SimpleNamespace(
        get_stock_historical=AsyncMock(
            return_value={
                'results': [
                    {
                        'requestedSymbol': 'PETR4',
                        'symbol': 'PETR4',
                        'data': {
                            'historicalDataPrice': [
                                {
                                    'date': 1735776000,
                                    'open': 35,
                                    'high': 36,
                                    'low': 34,
                                    'close': 35.5,
                                    'adjustedClose': 34.5,
                                    'volume': 100,
                                },
                                {
                                    'date': 1736035200,
                                    'open': 36,
                                    'high': 37,
                                    'low': 35,
                                    'close': 36.5,
                                    'adjustedClose': 35.5,
                                    'volume': 120,
                                },
                            ]
                        },
                    }
                ]
            }
        )
    )

    result = await provider.fetch_quotes(
        ticker='PETR4',
        asset_type_id=ASSET_TYPE.STOCK,
        exchange='B3',
    )

    assert [point.date for point in result.quotes] == [
        date(2025, 1, 2),
        date(2025, 1, 5),
    ]
    assert result.quotes[0].adjusted_close == EXPECTED_ADJUSTED_CLOSE
    provider.brapi_client.get_stock_historical.assert_awaited_once()


@pytest.mark.asyncio
async def test_etf_provider_uses_the_normalized_stock_history_contract():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.brapi_client = SimpleNamespace(
        get_stock_historical=AsyncMock(return_value={'results': []})
    )

    result = await provider.fetch_quotes(
        ticker='BOVA11',
        asset_type_id=ASSET_TYPE.ETF,
        exchange='B3',
    )

    assert result.ticker == 'BOVA11'
    assert result.quotes == []
    provider.brapi_client.get_stock_historical.assert_awaited_once()


@pytest.mark.asyncio
async def test_fii_provider_uses_its_distinct_normalized_history_contract():
    provider = MarketDataProvider.__new__(MarketDataProvider)
    provider.brapi_client = SimpleNamespace(
        get_fii_historical=AsyncMock(
            return_value={
                'fiis': [
                    {
                        'symbol': 'HGLG11',
                        'historicalDataPrice': [{'date': 1735776000, 'close': 158.4}],
                    }
                ]
            }
        )
    )

    result = await provider.fetch_quotes(
        ticker='HGLG11',
        asset_type_id=ASSET_TYPE.FII,
    )

    assert result.ticker == 'HGLG11'
    assert result.quotes[0].date == date(2025, 1, 2)
    provider.brapi_client.get_fii_historical.assert_awaited_once()


@pytest.mark.asyncio
async def test_retained_integration_client_uses_stock_history_endpoint():
    client = BrapiClient()
    client._get = AsyncMock(return_value={'results': []})

    result = await client.get_stock_historical(
        symbols='PETR4',
        range='max',
        interval='1d',
    )

    assert result == {'results': []}
    client._get.assert_awaited_once_with(
        '/v2/stocks/historical',
        {'symbols': 'PETR4', 'range': 'max', 'interval': '1d'},
    )
    await client.aclose()
