from fastapi import Depends

from app.infra.db.unit_of_work import UnitOfWork, get_uow
from app.infra.openai.openai_client import get_ai_provider
from app.modules.ai.domain.provider import AIProvider
from app.modules.ai.service.ai_artifact_service import AIArtifactService
from app.modules.ai.service.ai_feature_service import AIFeatureService


def get_ai_feature_service(uow: UnitOfWork = Depends(get_uow)) -> AIFeatureService:
    return AIFeatureService(uow)


def get_ai_artifact_service(
    uow: UnitOfWork = Depends(get_uow),
    provider: AIProvider = Depends(get_ai_provider),
) -> AIArtifactService:
    return AIArtifactService(uow=uow, provider=provider)
