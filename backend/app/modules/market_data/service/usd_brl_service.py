from datetime import date
from decimal import Decimal

from app.core.exceptions import NotFoundError
from app.modules.market_data.domain.usd_brl import (
    convert_brl_to_usd,
    convert_usd_to_brl,
)
from app.infra.db.unit_of_work import UnitOfWork


class UsdBrlReadService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_history(self, *, start_date: date | None = None):
        async with self.uow as uow:
            return await uow.market_data.get_usd_brl_history(start_date)

    async def convert(
        self,
        *,
        amount: Decimal,
        direction: str,
        target_date: date,
    ) -> dict:
        async with self.uow as uow:
            rate = await uow.market_data.get_usd_brl_rate_on_or_before(target_date)
        if rate is None:
            raise NotFoundError('USD/BRL history not found on or before the requested date')
        if direction == 'usd_to_brl':
            converted = convert_usd_to_brl(amount, rate.usd_brl)
            applied_rate = rate.usd_brl
        elif direction == 'brl_to_usd':
            converted = convert_brl_to_usd(amount, rate.brl_usd)
            applied_rate = rate.brl_usd
        else:
            raise ValueError('Unsupported conversion direction')
        return {
            'amount': amount,
            'converted_amount': converted,
            'direction': direction,
            'rate': applied_rate,
            'rate_date': rate.date,
        }
