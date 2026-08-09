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
