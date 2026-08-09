from app.modules.ai.domain.entities import AIFeature
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.api.schemas import AIFeatureUpdate
from fastapi import HTTPException


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

    async def update(self, feature_id: int, payload: AIFeatureUpdate) -> AIFeature:
        async with self.uow as uow:
            feature = await uow.repository.get(AIFeature, id=feature_id)
            if not feature:
                raise HTTPException(status_code=404, detail='AI feature not found')
            data = payload.model_dump(exclude_none=True)
            for key, value in data.items():
                setattr(feature, key, value)
            await uow.commit()
            return feature
