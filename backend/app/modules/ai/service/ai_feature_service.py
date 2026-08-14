from fastapi import HTTPException

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.domain.entities import AIFeature


class AIFeatureService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list(self) -> list[AIFeature]:
        async with self.uow as uow:
            return await uow.repository.get(AIFeature, order_by='key')

    async def get(self, feature_id: int) -> AIFeature:
        async with self.uow as uow:
            feature = await uow.repository.get(AIFeature, id=feature_id)
            if not feature:
                raise HTTPException(status_code=404, detail='AI feature not found')
            return feature

    async def update(self, feature_id: int, *, default_ttl_hours: int | None = None) -> AIFeature:
        async with self.uow as uow:
            feature = await uow.repository.get(AIFeature, id=feature_id)
            if not feature:
                raise HTTPException(status_code=404, detail='AI feature not found')
            if default_ttl_hours is not None:
                feature.default_ttl_hours = default_ttl_hours
            await uow.commit()
            return feature
