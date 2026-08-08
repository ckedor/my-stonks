from app.modules.ai.domain.entities import AIFeature
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.api.schemas import AIFeatureUpdate
from fastapi import HTTPException


class AIFeatureService:
    def __init__(
        self,
        repository: SQLAlchemyRepository | None = None,
        uow: UnitOfWork | None = None,
    ):
        self.repository = repository
        self.uow = uow

    def _read_repository(self) -> SQLAlchemyRepository:
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return self.repository

    async def list(self) -> list[AIFeature]:
        return await self._read_repository().get(AIFeature, order_by='key')

    async def get(self, feature_id: int) -> AIFeature:
        feature = await self._read_repository().get(AIFeature, id=feature_id)
        if not feature:
            raise HTTPException(status_code=404, detail='AI feature not found')
        return feature

    async def update(self, feature_id: int, payload: AIFeatureUpdate) -> AIFeature:
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')

        async with self.uow as uow:
            feature = await uow.repository.get(AIFeature, id=feature_id)
            if not feature:
                raise HTTPException(status_code=404, detail='AI feature not found')
            data = payload.model_dump(exclude_none=True)
            for key, value in data.items():
                setattr(feature, key, value)
            return feature
