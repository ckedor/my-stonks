from datetime import UTC, datetime, timedelta

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.domain.entities import AIRun

DEFAULT_WINDOW_DAYS = 30
DEFAULT_RUN_LIMIT = 100


class AIUsageService:
    """What the AI has cost, read from the same rows that recorded it.

    There is no cache in front of any of this, and no second store behind it.
    Every provider call writes one row at the provider boundary, so the ledger
    is complete by construction rather than by remembering to instrument each
    caller.
    """

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def usage_by_day(self, days: int = DEFAULT_WINDOW_DAYS) -> list[dict]:
        since = datetime.now(UTC) - timedelta(days=days)
        async with self.uow as uow:
            return await uow.ai.usage_by_day(since)

    async def recent_runs(self, limit: int = DEFAULT_RUN_LIMIT) -> list[AIRun]:
        async with self.uow as uow:
            return await uow.ai.recent_runs(limit)

    async def spent_last_24h(self) -> float:
        async with self.uow as uow:
            return await uow.ai.cost_since(datetime.now(UTC) - timedelta(days=1))
