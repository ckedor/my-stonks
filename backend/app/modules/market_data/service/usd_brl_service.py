from datetime import date
from decimal import Decimal

import pandas as pd

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.domain.usd_brl import (
    UsdBrlHistory,
    convert_brl_to_usd,
    convert_usd_to_brl,
    find_rate_on_or_before,
    usd_brl_history_to_cache_payload,
    usd_brl_payload_slice,
    usd_brl_payload_to_df,
)

USD_BRL_HISTORY_CACHE_PREFIX = 'usd_brl_history'

#: The rate ingestion invalidates this cache explicitly, so the expiry is only a
#: safety net for a run that never happens.
USD_BRL_HISTORY_TTL_SECONDS = 86400


class UsdBrlReadService:
    """The canonical exchange rate, read once and sliced in memory.

    The table holds one row per calendar date and never rewrites history, so the
    whole of it is cached under a single key. Keying by ``start_date`` instead
    would give every caller its own entry -- consolidation asks from a
    portfolio's first trade, charts from a chosen window, conversions from ten
    days back -- and almost none of them would ever hit.
    """

    def __init__(self, uow: UnitOfWork, cache: RedisService | None = None):
        self.uow = uow
        self.cache = cache or RedisService()

    @cached(
        key_prefix=USD_BRL_HISTORY_CACHE_PREFIX,
        cache=lambda self: self.cache,
        ttl=USD_BRL_HISTORY_TTL_SECONDS,
    )
    async def get_full_history(self) -> list[dict]:
        """Every persisted rate, oldest first. Takes no arguments: one key."""
        return await self.compute_full_history()

    async def compute_full_history(self) -> list[dict]:
        async with self.uow as uow:
            history = await uow.market_data.get_usd_brl_history()
        return usd_brl_history_to_cache_payload(history)

    async def get_history(self, *, start_date: date | None = None) -> list[dict]:
        return usd_brl_payload_slice(await self.get_full_history(), start_date)

    async def get_history_df(self, *, start_date: date | None = None) -> pd.DataFrame:
        """The rate history as a DataFrame, for the pandas-based price pipelines."""
        return usd_brl_payload_to_df(await self.get_history(start_date=start_date))

    async def get_rate_on_or_before(self, target_date: date) -> UsdBrlHistory:
        """The rate in effect on ``target_date``, both directions."""
        rate = find_rate_on_or_before(await self.get_full_history(), target_date)
        if rate is None:
            raise NotFoundError('USD/BRL history not found on or before the requested date')
        return rate

    async def convert(
        self,
        *,
        amount: Decimal,
        direction: str,
        target_date: date,
    ) -> dict:
        rate = await self.get_rate_on_or_before(target_date)
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
