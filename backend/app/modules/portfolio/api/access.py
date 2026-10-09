"""Who may touch a portfolio: its owner, and nobody else.

A portfolio's routes are reached by id, and an id is something anybody can type.
So every route that names a portfolio — or a row of one, such as a transaction —
passes through `PortfolioBaseService.ensure_owner` before it reads or writes.
The rule lives there; this module only wires it into the request.

- `OwnedPortfolioId` replaces `portfolio_id: int` on a route whose id comes in
  the path or the query string.
- `OwnedFormPortfolioId` does the same for a multipart form.
- `PortfolioGuard` is for what arrives in a JSON body or as a row id: the route
  calls it with every id it is about to act on, once the body is parsed.

`tests/e2e/test_portfolio_isolation.py` sends every route under `/portfolio` as
somebody else and fails on the one that answers.
"""

from collections.abc import Awaitable, Iterable, Sequence
from typing import Annotated, Protocol

from fastapi import Depends, Form

from app.composition.portfolio import get_portfolio_service
from app.modules.portfolio.service.portfolio_base_service import PortfolioBaseService
from app.modules.users.domain import User
from app.modules.users.views import current_active_user


class PortfolioGuardCall(Protocol):
    def __call__(
        self,
        *,
        portfolios: Iterable[int] = (),
        transactions: Iterable[int] = (),
        dividends: Iterable[int] = (),
        categories: Iterable[int] = (),
    ) -> Awaitable[None]: ...


def _portfolio_guard(
    user: User = Depends(current_active_user),
    service: PortfolioBaseService = Depends(get_portfolio_service),
) -> PortfolioGuardCall:
    def guard(**ids: Iterable[int]) -> Awaitable[None]:
        return service.ensure_owner(user.id, **ids)

    return guard


PortfolioGuard = Annotated[PortfolioGuardCall, Depends(_portfolio_guard)]


async def _owned_portfolio_id(portfolio_id: int, guard: PortfolioGuard) -> int:
    await guard(portfolios=[portfolio_id])
    return portfolio_id


async def _owned_form_portfolio_id(guard: PortfolioGuard, portfolio_id: int = Form(...)) -> int:
    return await _owned_portfolio_id(portfolio_id, guard)


OwnedPortfolioId = Annotated[int, Depends(_owned_portfolio_id)]
OwnedFormPortfolioId = Annotated[int, Depends(_owned_form_portfolio_id)]


class _CategoryRef(Protocol):
    id: int | None
    portfolio_id: int | None


def category_refs(categories: Sequence[_CategoryRef]) -> dict[str, list[int]]:
    """What a list of categories points at, for `PortfolioGuard`.

    A category with an id is an update of that row, and its `portfolio_id` is
    where it will be written: both have to be the caller's, or a list could
    move someone else's category into the caller's portfolio, or write one
    into theirs.
    """
    return {
        'categories': [c.id for c in categories if c.id is not None],
        'portfolios': [c.portfolio_id for c in categories if c.portfolio_id is not None],
    }
