# app/modules/portfolio/service/portfolio_base_service.py
"""
Portfolio base service - handles portfolio CRUD operations.
"""

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.modules.portfolio.domain.entities import (
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    Position,
    Transaction,
)
from app.infra.redis.redis_service import RedisService
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.api.portfolio.schemas import (
    CreatePortfolioRequest,
    UpdatePortfolioRequest,
)
from app.modules.portfolio.repositories import PortfolioRepository


class PortfolioBaseService:
    def __init__(
        self,
        repository: PortfolioRepository | None = None,
        uow: UnitOfWork | None = None,
        cache: RedisService | None = None,
    ):
        self.repository = repository
        self.uow = uow
        self.cache = cache or RedisService()

    def _read_repository(self) -> PortfolioRepository:
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return self.repository

    def _write_uow(self) -> UnitOfWork:
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        return self.uow

    async def create_portfolio(self, portfolio: CreatePortfolioRequest, user_id: int):
        async with self._write_uow() as uow:
            id_list = await uow.portfolios.create(
                Portfolio,
                {'name': portfolio.name, 'user_id': user_id},
            )
            if not id_list:
                raise BusinessRuleError('Erro ao criar portfolio')
            categories = [
                CustomCategory(
                    **cat.model_dump(exclude={'portfolio_id'}),
                    portfolio_id=id_list[0],
                )
                for cat in portfolio.user_categories
            ]
            await uow.portfolios.create(CustomCategory, categories)
            return id_list[0]

    async def list_user_portfolios(self, user_id: int) -> Portfolio:
        portfolios = await self._read_repository().get_user_portfolios(user_id)
        return portfolios

    async def update_portfolio(self, portfolio: UpdatePortfolioRequest) -> None:    
        async with self._write_uow() as uow:
            portfolio_obj = await uow.portfolios.get(Portfolio, portfolio.id)
            if not portfolio_obj:
                raise NotFoundError('Portfolio não encontrado')

            await uow.portfolios.update(
                Portfolio,
                portfolio.model_dump(exclude={'user_categories'}),
            )

            for cat in portfolio.user_categories:
                if cat.id is None:
                    await uow.portfolios.create(CustomCategory, cat.model_dump())
                else:
                    await uow.portfolios.update(CustomCategory, cat.model_dump())

    async def delete_portfolio(self, portfolio_id: int) -> None:
        async with self._write_uow() as uow:
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
