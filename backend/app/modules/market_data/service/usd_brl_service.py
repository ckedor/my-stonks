from datetime import date
from decimal import Decimal

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.usd_brl import (
    convert_brl_to_usd,
    convert_usd_to_brl,
)
from app.modules.market_data.repositories.market_data_repository import MarketDataRepository


class UsdBrlReadService:
    def __init__(self, repository: MarketDataRepository):
        self.repository = repository

    async def get_history(self, *, start_date: date | None = None):
        return await self.repository.get_usd_brl_history(start_date)

    async def convert(
        self,
        *,
        amount: Decimal,
        direction: str,
        target_date: date,
    ) -> dict:
        rate = await self.repository.get_usd_brl_rate_on_or_before(target_date)
        if rate is None:
            raise NotFoundError('USD/BRL history not found on or before the requested date')
        if direction == 'usd_to_brl':
            converted = convert_usd_to_brl(amount, rate.usd_to_brl_rate)
        elif direction == 'brl_to_usd':
            converted = convert_brl_to_usd(amount, rate.usd_to_brl_rate)
        else:
            raise ValueError('Unsupported conversion direction')
        return {
            'amount': amount,
            'converted_amount': converted,
            'direction': direction,
            'rate': rate.usd_to_brl_rate,
            'rate_date': rate.date,
        }
