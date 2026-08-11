"""Test doubles shared across unit tests."""

from types import SimpleNamespace
from unittest.mock import AsyncMock


class FakeUnitOfWork:
    """Stands in for UnitOfWork: same repository attributes, no session.

    Pass only the repositories a test cares about; the rest default to empty
    namespaces so an accidental call fails loudly instead of silently passing.
    """

    def __init__(self, **repositories):
        for name in ('repository', 'assets', 'market_data', 'quotes', 'ingestions', 'portfolios'):
            setattr(self, name, SimpleNamespace())
        for name, repository in repositories.items():
            setattr(self, name, repository)
        self.commit = AsyncMock()
        self.entered = 0
        self.exit_errors = []

    async def __aenter__(self):
        self.entered += 1
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        self.exit_errors.append(exc_type)
        return False


def fake_uow_factory(uow: FakeUnitOfWork):
    """Return a ``uow_factory`` callable that always yields ``uow``."""
    return lambda: uow


class FakeCache:
    """In-memory stand-in for ``RedisService``, with the same surface.

    Values are stored as-is rather than serialized, so a test asserting on a
    cached payload sees exactly what the service handed over. ``writes`` counts
    fills, which is how a test tells a hit from a miss.
    """

    def __init__(self):
        self.store: dict = {}
        self.writes = 0

    async def get_json(self, key: str):
        return self.store.get(key)

    async def set_json(self, key: str, value, expire_seconds: int | None = None) -> None:
        self.store[key] = value
        self.writes += 1

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)

    async def delete_prefix(self, key_prefix: str) -> int:
        doomed = [key for key in self.store if key.startswith(key_prefix)]
        for key in doomed:
            del self.store[key]
        return len(doomed)
