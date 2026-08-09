from decimal import Decimal
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.usd_brl import (
    convert_brl_to_usd,
    convert_usd_to_brl,
    invert_rate,
    usd_brl_history_to_df,
    UsdBrlHistory,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from tests.fakes import FakeUnitOfWork


def build_rate(usd_brl: str) -> SimpleNamespace:
    rate = Decimal(usd_brl)
    return SimpleNamespace(date=date(2026, 8, 7), usd_brl=rate, brl_usd=invert_rate(rate))


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


@pytest.mark.asyncio
async def test_usd_to_brl_conversion_uses_latest_rate_on_or_before_date():
    repository = SimpleNamespace(
        get_usd_brl_rate_on_or_before=AsyncMock(return_value=build_rate('5'))
    )
    service = UsdBrlReadService(FakeUnitOfWork(market_data=repository))

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
    repository = SimpleNamespace(
        get_usd_brl_rate_on_or_before=AsyncMock(return_value=build_rate('5'))
    )
    service = UsdBrlReadService(FakeUnitOfWork(market_data=repository))

    result = await service.convert(
        amount=Decimal('50'),
        direction='brl_to_usd',
        target_date=date(2026, 8, 8),
    )

    assert result['converted_amount'] == Decimal('10.000000000000')
    assert result['rate'] == Decimal('0.200000000000')
