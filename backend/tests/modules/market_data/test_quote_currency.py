"""Quote history restated in the requested currency."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.constants import CURRENCY
from app.modules.market_data.domain.quote import convert_quotes_to_currency
from app.modules.market_data.domain.usd_brl import (
    UsdBrlHistory,
    invert_rate,
    usd_brl_history_to_cache_payload,
)
from app.modules.market_data.service.quote_service import AssetQuoteHistoryService
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from tests.fakes import FakeCache, FakeUnitOfWork

ASSET_ID = 7
TICKER = 'PETR4'
LOGO = 'https://example.invalid/petr4.png'
#: A BRL close of 50 at a rate of 5.00 is 10 USD.
BRL_CLOSE = 50.0
USD_CLOSE = 10.0
VOLUME = 1000.0


def rate_payload(*pairs: tuple[date, str]) -> list[dict]:
    return usd_brl_history_to_cache_payload([
        UsdBrlHistory(
            date=on,
            usd_brl=Decimal(value),
            brl_usd=invert_rate(Decimal(value)),
            source='bcb',
        )
        for on, value in pairs
    ])


def quote(on: date, close: float, currency_id: int | None = CURRENCY.BRL) -> dict:
    return {
        'date': on.isoformat(),
        'open': close,
        'high': close,
        'low': close,
        'close': close,
        'adjusted_close': None,
        'volume': VOLUME,
        'currency_id': currency_id,
        'source': 'brapi',
    }


def test_brl_quotes_restated_in_usd_multiply_by_the_stored_inverse():
    rates = rate_payload((date(2026, 8, 7), '5'))

    converted = convert_quotes_to_currency(
        [quote(date(2026, 8, 7), BRL_CLOSE)],
        rates,
        target_currency_id=CURRENCY.USD,
    )

    assert converted[0]['close'] == pytest.approx(USD_CLOSE)
    assert converted[0]['open'] == pytest.approx(USD_CLOSE)
    assert converted[0]['currency_id'] == CURRENCY.USD
    # Volume is a share count, not money.
    assert converted[0]['volume'] == VOLUME
    # A field the provider left empty stays empty.
    assert converted[0]['adjusted_close'] is None


def test_usd_quotes_restated_in_brl_multiply_by_the_rate():
    rates = rate_payload((date(2026, 8, 7), '5'))

    converted = convert_quotes_to_currency(
        [quote(date(2026, 8, 7), USD_CLOSE, currency_id=CURRENCY.USD)],
        rates,
        target_currency_id=CURRENCY.BRL,
    )

    assert converted[0]['close'] == pytest.approx(BRL_CLOSE)
    assert converted[0]['currency_id'] == CURRENCY.BRL


def test_quotes_already_in_the_target_currency_are_untouched():
    converted = convert_quotes_to_currency(
        [quote(date(2026, 8, 7), BRL_CLOSE)],
        rate_payload((date(2026, 8, 7), '5')),
        target_currency_id=CURRENCY.BRL,
    )

    assert converted[0]['close'] == BRL_CLOSE


def test_a_weekend_quote_carries_the_last_published_rate_forward():
    # The rate is published on business days; a cryptoasset trades on Saturday.
    rates = rate_payload((date(2026, 8, 7), '5'))

    converted = convert_quotes_to_currency(
        [quote(date(2026, 8, 8), BRL_CLOSE), quote(date(2026, 8, 9), BRL_CLOSE * 2)],
        rates,
        target_currency_id=CURRENCY.USD,
    )

    assert [point['close'] for point in converted] == [
        pytest.approx(USD_CLOSE),
        pytest.approx(USD_CLOSE * 2),
    ]


def test_quotes_that_cannot_be_restated_are_dropped_rather_than_guessed():
    rates = rate_payload((date(2026, 8, 7), '5'))

    converted = convert_quotes_to_currency(
        [
            # Older than the whole rate history.
            quote(date(2026, 8, 1), BRL_CLOSE),
            # No currency of its own, and no series-level fallback.
            quote(date(2026, 8, 7), BRL_CLOSE, currency_id=None),
            quote(date(2026, 8, 7), BRL_CLOSE),
        ],
        rates,
        target_currency_id=CURRENCY.USD,
    )

    assert len(converted) == 1
    assert converted[0]['close'] == pytest.approx(USD_CLOSE)


def build_service(quotes: list[dict], rates: list[dict]) -> AssetQuoteHistoryService:
    repository = SimpleNamespace(
        get_usd_brl_history=AsyncMock(
            return_value=[
                UsdBrlHistory(
                    date=date.fromisoformat(item['date']),
                    usd_brl=Decimal(item['usd_brl']),
                    brl_usd=Decimal(item['brl_usd']),
                    source=item['source'],
                )
                for item in rates
            ]
        )
    )
    return AssetQuoteHistoryService(
        persisted=SimpleNamespace(
            get_quotes=AsyncMock(
                return_value=[{
                    'asset_id': ASSET_ID,
                    'ticker': TICKER,
                    'asset_type_id': 4,
                    'quotes': quotes,
                }]
            )
        ),
        on_demand=SimpleNamespace(
            get_logo=AsyncMock(return_value={'logo_url': LOGO}),
            get_quotes=AsyncMock(),
        ),
        usd_brl=UsdBrlReadService(
            FakeUnitOfWork(market_data=repository),
            cache=FakeCache(),
        ),
    )


@pytest.mark.asyncio
async def test_history_in_usd_converts_a_brl_asset_and_reports_the_currency():
    service = build_service(
        [quote(date(2026, 8, 7), BRL_CLOSE)],
        rate_payload((date(2026, 8, 7), '5')),
    )

    result = await service.get_history(asset_id=ASSET_ID, currency='USD')

    assert result['currency'] == 'USD'
    assert result['source'] == 'database'
    assert result['quotes'][0]['close'] == pytest.approx(USD_CLOSE)


@pytest.mark.asyncio
async def test_history_in_the_assets_own_currency_never_reads_the_rate():
    service = build_service(
        [quote(date(2026, 8, 7), BRL_CLOSE)],
        rate_payload((date(2026, 8, 7), '5')),
    )

    result = await service.get_history(asset_id=ASSET_ID, currency='BRL')

    assert result['currency'] == 'BRL'
    assert result['quotes'][0]['close'] == BRL_CLOSE
    service.usd_brl.uow.market_data.get_usd_brl_history.assert_not_awaited()


@pytest.mark.asyncio
async def test_history_reports_no_currency_when_the_quotes_do_not_say_theirs():
    service = build_service(
        [quote(date(2026, 8, 7), BRL_CLOSE, currency_id=None)],
        rate_payload((date(2026, 8, 7), '5')),
    )

    result = await service.get_history(asset_id=ASSET_ID, currency='USD')

    # Nothing to convert from, so the prices are served as they are rather than
    # relabelled as something they are not.
    assert result['currency'] is None
    assert result['quotes'][0]['close'] == BRL_CLOSE
