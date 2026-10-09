# app/modules/portfolio/service/portfolio_base_service.py
"""
Portfolio base service - handles portfolio CRUD operations.
"""

from collections.abc import Iterable

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.category import NewCategory
from app.modules.portfolio.domain.entities import (
    BrokerageNote,
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    PortfolioConsolidation,
    Position,
    Transaction,
)

PORTFOLIO_NOT_FOUND = 'Portfolio não encontrado'


class PortfolioBaseService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def create_portfolio(self, user_id: int, *, name: str, categories: list[NewCategory]):
        async with self.uow as uow:
            id_list = await uow.portfolios.create(
                Portfolio,
                {'name': name, 'user_id': user_id},
            )
            if not id_list:
                raise BusinessRuleError('Erro ao criar portfolio')
            await uow.portfolios.create(
                CustomCategory,
                [
                    CustomCategory(
                        name=category.name,
                        color=category.color,
                        benchmark_id=category.benchmark_id,
                        portfolio_id=id_list[0],
                    )
                    for category in categories
                ],
            )
            await uow.commit()
            return id_list[0]

    async def ensure_owner(
        self,
        user_id: int,
        *,
        portfolios: Iterable[int] = (),
        transactions: Iterable[int] = (),
        dividends: Iterable[int] = (),
        categories: Iterable[int] = (),
    ) -> None:
        """Refuse unless every portfolio named, directly or through a row of it, is the user's.

        A row is followed to its portfolio rather than trusted to belong to the one
        the request names: a request that pairs the caller's own portfolio with
        somebody else's transaction would otherwise pass. Missing and foreign are
        the same answer, so the error does not confirm that an id exists. Being an
        administrator grants nothing here; administrative routes that act on any
        portfolio are guarded as such and never reach this check.
        """
        portfolio_ids = set(portfolios)
        async with self.uow as uow:
            for model, ids in (
                (Transaction, set(transactions)),
                (Dividend, set(dividends)),
                (CustomCategory, set(categories)),
            ):
                if not ids:
                    continue
                parents = await uow.portfolios.get_parent_portfolio_ids(model, list(ids))
                if parents.keys() != ids:
                    raise NotFoundError(PORTFOLIO_NOT_FOUND)
                portfolio_ids |= set(parents.values())

            if not portfolio_ids:
                return
            owners = await uow.portfolios.get_portfolio_owners(list(portfolio_ids))
        if owners.keys() != portfolio_ids or set(owners.values()) != {user_id}:
            raise NotFoundError(PORTFOLIO_NOT_FOUND)

    async def list_user_portfolios(self, user_id: int) -> Portfolio:
        async with self.uow as uow:
            return await uow.portfolios.get_user_portfolios(user_id)

    async def list_all_portfolios(self) -> list[Portfolio]:
        async with self.uow as uow:
            return await uow.portfolios.get_all_portfolios()

    async def update_portfolio(
        self, portfolio_id: int, *, name: str, categories: list[CustomCategory]
    ) -> None:
        async with self.uow as uow:
            portfolio_obj = await uow.portfolios.get(Portfolio, portfolio_id)
            if not portfolio_obj:
                raise NotFoundError(PORTFOLIO_NOT_FOUND)

            await uow.portfolios.update(Portfolio, {'id': portfolio_id, 'name': name})

            for category in categories:
                if category.id is None:
                    await uow.portfolios.create(CustomCategory, [category])
                else:
                    await uow.portfolios.update(CustomCategory, category)
            await uow.commit()

    async def delete_portfolio(self, portfolio_id: int) -> None:
        async with self.uow as uow:
            portfolio = await uow.portfolios.get(Portfolio, portfolio_id)
            if not portfolio:
                raise NotFoundError(PORTFOLIO_NOT_FOUND)

            custom_categories = await uow.portfolios.get(
                CustomCategory, by={'portfolio_id': portfolio_id}
            )
            for custom_category in custom_categories:
                await uow.portfolios.delete(
                    CustomCategoryAssignment,
                    by={'custom_category_id': custom_category.id},
                )
            await uow.portfolios.delete(CustomCategory, by={'portfolio_id': portfolio_id})
            # Séries e carimbo apontam para a carteira mas nada cascateia a
            # partir de `scope_key`, que é texto. Saem aqui, explicitamente.
            await uow.portfolios.delete_return_series(portfolio_id)
            await uow.portfolios.delete(PortfolioConsolidation, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Position, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Transaction, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(BrokerageNote, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Dividend, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Portfolio, portfolio_id)
            await uow.commit()
