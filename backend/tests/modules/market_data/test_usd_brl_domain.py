from decimal import Decimal
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.usd_brl import (
    convert_brl_to_usd,
    convert_usd_to_brl,
    find_rate_on_or_before,
    invert_rate,
    usd_brl_history_to_cache_payload,
    usd_brl_history_to_df,
    usd_brl_payload_slice,
    UsdBrlHistory,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from tests.fakes import FakeCache, FakeUnitOfWork


def build_rate(usd_brl: str, on: date = date(2026, 8, 7)) -> SimpleNamespace:
    rate = Decimal(usd_brl)
    return SimpleNamespace(
        date=on,
        usd_brl=rate,
        brl_usd=invert_rate(rate),
        source='bcb',
    )


def test_conversions_multiply_in_both_directions():
    rate = build_rate('5.25')

    assert convert_usd_to_brl(Decimal('10'), rate.usd_brl) == Decimal('52.50')
    # brl_usd is a stored inverse, so the round trip lands within its precision.
    assert convert_brl_to_usd(Decimal('52.50'), rate.brl_usd) == pytest.approx(
        Decimal('10'), abs=Decimal('1e-9')
    )


def test_invert_rate_round_trips_within_stored_precision():
    assert invert_rate(Decimal('5')) == Decimal('0.200000000000')
    assert invert_rate(Decimal('4')) * Decimal('4') == Decimal('1.000000000000')


def test_invert_rate_rejects_non_positive_rate():
    with pytest.raises(ValueError, match='greater than zero'):
        invert_rate(Decimal('0'))


def test_brl_to_usd_rejects_non_positive_rate():
    with pytest.raises(ValueError, match='greater than zero'):
        convert_brl_to_usd(Decimal('10'), Decimal('0'))


def test_history_dataframe_exposes_both_directions():
    df = usd_brl_history_to_df([
        UsdBrlHistory(
            date=date(2026, 8, 7),
            usd_brl=Decimal('5'),
            brl_usd=Decimal('0.2'),
            source='bcb',
        )
    ])

    assert list(df.columns) == ['date', 'usd_brl', 'brl_usd']
    assert df.iloc[0]['usd_brl'] == 5.0
    assert df.iloc[0]['brl_usd'] == 0.2


def build_service(*rates: SimpleNamespace) -> UsdBrlReadService:
    """A reader over the given rates, with an in-memory cache standing in."""
    repository = SimpleNamespace(get_usd_brl_history=AsyncMock(return_value=list(rates)))
    return UsdBrlReadService(FakeUnitOfWork(market_data=repository), cache=FakeCache())


@pytest.mark.asyncio
async def test_usd_to_brl_conversion_uses_latest_rate_on_or_before_date():
    service = build_service(build_rate('5'))

    result = await service.convert(
        amount=Decimal('10'),
        direction='usd_to_brl',
        target_date=date(2026, 8, 8),
    )

    assert result['converted_amount'] == Decimal('50')
    assert result['rate'] == Decimal('5')
    assert result['rate_date'] == date(2026, 8, 7)


@pytest.mark.asyncio
async def test_brl_to_usd_conversion_reports_the_inverted_rate_it_applied():
    service = build_service(build_rate('5'))

    result = await service.convert(
        amount=Decimal('50'),
        direction='brl_to_usd',
        target_date=date(2026, 8, 8),
    )

    assert result['converted_amount'] == Decimal('10.000000000000')
    assert result['rate'] == Decimal('0.200000000000')


@pytest.mark.asyncio
async def test_conversion_fails_when_history_starts_after_the_requested_date():
    service = build_service(build_rate('5'))

    with pytest.raises(NotFoundError):
        await service.convert(
            amount=Decimal('10'),
            direction='usd_to_brl',
            target_date=date(2026, 8, 6),
        )


def test_cache_payload_keeps_rates_as_strings_so_decimal_survives():
    payload = usd_brl_history_to_cache_payload([
        UsdBrlHistory(
            date=date(2026, 8, 7),
            usd_brl=Decimal('5.43210987'),
            brl_usd=Decimal('0.184090123456'),
            source='bcb',
        )
    ])

    assert payload == [{
        'date': '2026-08-07',
        'usd_brl': '5.43210987',
        'brl_usd': '0.184090123456',
        'source': 'bcb',
    }]
    rate = find_rate_on_or_before(payload, date(2026, 8, 7))
    assert rate.usd_brl == Decimal('5.43210987')
    assert rate.brl_usd == Decimal('0.184090123456')


def test_payload_slice_keeps_entries_from_the_start_date_onwards():
    payload = usd_brl_history_to_cache_payload([
        build_rate('5', on=date(2026, 8, 5)),
        build_rate('6', on=date(2026, 8, 6)),
        build_rate('7', on=date(2026, 8, 7)),
    ])

    assert [item['date'] for item in usd_brl_payload_slice(payload, date(2026, 8, 6))] == [
        '2026-08-06',
        '2026-08-07',
    ]
    assert len(usd_brl_payload_slice(payload, None)) == len(payload)


def test_find_rate_falls_back_to_the_last_published_business_day():
    payload = usd_brl_history_to_cache_payload([
        build_rate('5', on=date(2026, 8, 5)),
        build_rate('6', on=date(2026, 8, 7)),
    ])

    # A Saturday takes Friday's rate; a date before the history has none.
    assert find_rate_on_or_before(payload, date(2026, 8, 8)).usd_brl == Decimal('6')
    assert find_rate_on_or_before(payload, date(2026, 8, 6)).usd_brl == Decimal('5')
    assert find_rate_on_or_before(payload, date(2026, 8, 4)) is None


@pytest.mark.asyncio
async def test_full_history_is_read_once_and_served_from_cache():
    repository = SimpleNamespace(
        get_usd_brl_history=AsyncMock(return_value=[build_rate('5')])
    )
    service = UsdBrlReadService(FakeUnitOfWork(market_data=repository), cache=FakeCache())

    await service.get_history()
    await service.get_history(start_date=date(2026, 8, 1))
    await service.get_rate_on_or_before(date(2026, 8, 8))

    # Three different reads, one trip to the database: the whole table is held
    # under a single key and sliced in memory.
    repository.get_usd_brl_history.assert_awaited_once()
