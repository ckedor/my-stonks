from app.infra.db.models.ai_feature import AIFeature
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.ai.api.schemas import AIFeatureUpdate
from fastapi import HTTPException


class AIFeatureService:
    def __init__(self, session):
        self.repo = SQLAlchemyRepository(session)
        self.session = session

    async def list(self) -> list[AIFeature]:
        return await self.repo.get(AIFeature, order_by='key')

    async def get(self, feature_id: int) -> AIFeature:
        feature = await self.repo.get(AIFeature, id=feature_id)
        if not feature:
            raise HTTPException(status_code=404, detail='AI feature not found')
        return feature

    async def update(self, feature_id: int, payload: AIFeatureUpdate) -> AIFeature:
        feature = await self.get(feature_id)
        data = payload.model_dump(exclude_none=True)
        if not data:
            return feature
        for key, value in data.items():
            setattr(feature, key, value)
        await self.session.commit()
        await self.session.refresh(feature)
        return feature
