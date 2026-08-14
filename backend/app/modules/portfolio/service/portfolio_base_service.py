# app/modules/portfolio/service/portfolio_base_service.py
"""
Portfolio base service - handles portfolio CRUD operations.
"""

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.portfolio.domain.category import NewCategory
from app.modules.portfolio.domain.entities import (
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    Position,
    Transaction,
)


class PortfolioBaseService:
    def __init__(
        self,
        uow: UnitOfWork,
        cache: RedisService | None = None,
    ):
        self.uow = uow
        self.cache = cache or RedisService()

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
                raise NotFoundError('Portfolio não encontrado')

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
                raise NotFoundError('Portfolio não encontrado')

            custom_categories = await uow.portfolios.get(
                CustomCategory, by={'portfolio_id': portfolio_id}
            )
            for custom_category in custom_categories:
                await uow.portfolios.delete(
                    CustomCategoryAssignment,
                    by={'custom_category_id': custom_category.id},
                )
            await uow.portfolios.delete(CustomCategory, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Position, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Transaction, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Dividend, by={'portfolio_id': portfolio_id})
            await uow.portfolios.delete(Portfolio, portfolio_id)
            await uow.commit()
