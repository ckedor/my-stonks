# app/modules/portfolio/service/portfolio_category_service.py
"""
Portfolio category service - handles custom category management.
"""

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.entities import CustomCategory, CustomCategoryAssignment
from app.modules.portfolio.domain.return_scope import ReturnScope, category_key


class PortfolioCategoryService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def save_custom_categories(self, categories) -> None:
        async with self.uow as uow:
            for cat in categories:
                if cat.id is None:
                    await uow.repository.create(CustomCategory, cat.model_dump())
                else:
                    await uow.repository.update(CustomCategory, cat.model_dump())
            await uow.commit()

    async def delete_custom_category(self, category_id: int) -> None:
        async with self.uow as uow:
            category = await uow.repository.get(CustomCategory, id=category_id)
            if category is not None:
                # A série da categoria referencia o id por texto, então nada
                # cascateia: sem esta linha ela sobrevive à categoria.
                await uow.portfolios.delete_return_series(
                    category.portfolio_id,
                    scope=ReturnScope.CATEGORY,
                    scope_key=category_key(category_id),
                )
            await uow.repository.delete(CustomCategory, id=category_id)
            await uow.commit()

    async def get_user_categories(self, portfolio_id: int):
        async with self.uow as uow:
            return await uow.repository.get(CustomCategory, portfolio_id)

    async def assign_category_to_asset(self, payload):
        portfolio_id = payload.portfolio_id

        async with self.uow as uow:
            portfolio_categories = await uow.repository.get(
                CustomCategory, by={'portfolio_id': portfolio_id}
            )
            portfolio_categories_ids = [cat.id for cat in portfolio_categories]
            assignment = await uow.repository.get(
                CustomCategoryAssignment,
                by={
                    'custom_category_id__in': portfolio_categories_ids,
                    'asset_id': payload.asset_id,
                },
                first=True,
            )
            if assignment is None:
                await uow.repository.create(
                    CustomCategoryAssignment,
                    {
                        'custom_category_id': payload.category_id,
                        'asset_id': payload.asset_id,
                    },
                )
            else:
                await uow.repository.update(
                    CustomCategoryAssignment,
                    {
                        'id': assignment.id,
                        'custom_category_id': payload.category_id,
                        'asset_id': payload.asset_id,
                    },
                )
            await uow.commit()
