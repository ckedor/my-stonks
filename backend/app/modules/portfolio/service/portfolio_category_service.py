# app/modules/portfolio/service/portfolio_category_service.py
"""
Portfolio category service - handles custom category management.
"""

from app.modules.portfolio.domain.entities import CustomCategory, CustomCategoryAssignment
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.unit_of_work import UnitOfWork


class PortfolioCategoryService:
    def __init__(
        self,
        repository: SQLAlchemyRepository | None = None,
        uow: UnitOfWork | None = None,
    ):
        self.repository = repository
        self.uow = uow

    def _write_uow(self) -> UnitOfWork:
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        return self.uow

    async def save_custom_categories(self, categories) -> None:
        async with self._write_uow() as uow:
            for cat in categories:
                if cat.id is None:
                    await uow.repository.create(CustomCategory, cat.model_dump())
                else:
                    await uow.repository.update(CustomCategory, cat.model_dump())

    async def delete_custom_category(self, category_id: int) -> None:
        async with self._write_uow() as uow:
            await uow.repository.delete(CustomCategory, id=category_id)

    async def get_user_categories(self, portfolio_id: int):
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return await self.repository.get(CustomCategory, portfolio_id)

    async def assign_category_to_asset(self, payload):
        portfolio_id = payload.portfolio_id
        
        async with self._write_uow() as uow:
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
