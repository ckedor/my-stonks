from decimal import Decimal
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.market_data.domain.usd_brl import (
    convert_brl_to_usd,
    convert_usd_to_brl,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService


def test_usd_brl_conversions_use_one_usd_in_brl_as_canonical_rate():
    rate = Decimal('5.25')

    assert convert_usd_to_brl(Decimal('10'), rate) == Decimal('52.50')
    assert convert_brl_to_usd(Decimal('52.50'), rate) == Decimal('10')


def test_brl_to_usd_rejects_non_positive_rate():
    with pytest.raises(ValueError, match='greater than zero'):
        convert_brl_to_usd(Decimal('10'), Decimal('0'))


@pytest.mark.asyncio
async def test_conversion_uses_latest_rate_on_or_before_requested_date():
    repository = SimpleNamespace(
        get_usd_brl_rate_on_or_before=AsyncMock(
            return_value=SimpleNamespace(
                date=date(2026, 8, 7),
                usd_to_brl_rate=Decimal('5'),
            )
        )
    )
    service = UsdBrlReadService(repository)

    result = await service.convert(
        amount=Decimal('10'),
        direction='usd_to_brl',
        target_date=date(2026, 8, 8),
    )

    assert result['converted_amount'] == Decimal('50')
    assert result['rate_date'] == date(2026, 8, 7)
