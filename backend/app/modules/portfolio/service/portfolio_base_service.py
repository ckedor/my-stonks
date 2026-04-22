# app/modules/portfolio/service/portfolio_base_service.py
"""
Portfolio base service - handles portfolio CRUD operations.
"""

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infra.db.models.portfolio import (
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    Position,
    Transaction,
)
from app.infra.redis.decorators import cached
from app.infra.redis.redis_service import RedisService
from app.modules.portfolio.api.portfolio.schemas import (
    CreatePortfolioRequest,
    UpdatePortfolioRequest,
)
from app.modules.portfolio.repositories import PortfolioRepository


class PortfolioBaseService:
    def __init__(self, session):
        self.session = session
        self.repo = PortfolioRepository(session)
        self.cache = RedisService()

    async def create_portfolio(self, portfolio: CreatePortfolioRequest, user_id: int):
        id_list = await self.repo.create(Portfolio, {'name': portfolio.name, 'user_id': user_id})
        user_categories = portfolio.user_categories
        if not id_list:
            raise BusinessRuleError('Erro ao criar portfolio')
        categories = [
            CustomCategory(
                **cat.model_dump(exclude={'portfolio_id'}),
                portfolio_id=id_list[0],
            )
            for cat in user_categories
        ]
        await self.repo.create(CustomCategory, categories)
        await self.session.commit()
        
        portfolio_id = id_list[0]
        return portfolio_id

    async def list_user_portfolios(self, user_id: int) -> Portfolio:
        portfolios = await self.repo.get_user_portfolios(user_id)
        return portfolios

    async def update_portfolio(self, portfolio: UpdatePortfolioRequest) -> None:    
        portfolio_obj = await self.repo.get(Portfolio, portfolio.id)
        if not portfolio_obj:
            raise NotFoundError('Portfolio não encontrado')

        await self.repo.update(
            Portfolio,
            portfolio.model_dump(exclude={'user_categories'}),
        )

        for cat in portfolio.user_categories:
            if cat.id is None:
                await self.repo.create(CustomCategory, cat.model_dump())
            else:
                await self.repo.update(CustomCategory, cat.model_dump())
        await self.session.commit()

    async def delete_portfolio(self, portfolio_id: int) -> None:
        portfolio = await self.repo.get(Portfolio, portfolio_id)
        if not portfolio:
            raise NotFoundError('Portfolio não encontrado')

        custom_categories = await self.repo.get(
            CustomCategory, by={'portfolio_id': portfolio_id}
        )   
        for custom_category in custom_categories:
            await self.repo.delete(CustomCategoryAssignment, by={'custom_category_id': custom_category.id})
        await self.repo.delete(CustomCategory, by={'portfolio_id': portfolio_id})
        await self.repo.delete(Position, by={'portfolio_id': portfolio_id})
        await self.repo.delete(Transaction, by={'portfolio_id': portfolio_id})
        await self.repo.delete(Dividend, by={'portfolio_id': portfolio_id})
        await self.repo.delete(Portfolio, portfolio_id)
        await self.session.commit()
