import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.exceptions import NotFoundError
from app.infra.db.models.ai_artifact import AIArtifact
from app.infra.db.models.ai_feature import AIFeature
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.domain.inputs import AIArtifactInput
from app.modules.ai.service.handlers import ARTIFACT_HANDLERS, AIResponse


class AIArtifactService:
    def __init__(self, session):
        self.session = session
        self.repo = SQLAlchemyRepository(session)

    async def get_or_generate_artifact(
        self,
        feature_key: AIFeatureKey,
        input: AIArtifactInput,
        force_generate: bool = False,
    ) -> dict[str, Any]:
        feature = await self._load_feature(feature_key)
        input_hash = self._hash_input(input)
        artifact = await self._find_artifact(feature.id, input_hash)

        if self._needs_generation(artifact, force_generate):
            ai_response = await self._generate(feature_key, input)
            artifact = await self._persist_artifact(
                artifact=artifact,
                feature=feature,
                input_hash=input_hash,
                ai_response=ai_response,
            )

        return self._build_response(feature_key, input, artifact)

    async def _load_feature(self, feature_key: AIFeatureKey) -> AIFeature:
        feature = await self.repo.get(AIFeature, by={'key': feature_key.value}, first=True)
        if feature is None:
            raise NotFoundError(f'AI feature {feature_key.value} is not configured')
        return feature

    async def _find_artifact(self, feature_id: int, input_hash: str) -> AIArtifact | None:
        return await self.repo.get(
            AIArtifact,
            by={'feature_id': feature_id, 'input_hash': input_hash},
            first=True,
        )

    @staticmethod
    def _needs_generation(artifact: AIArtifact | None, force_generate: bool) -> bool:
        if artifact is None or force_generate:
            return True
        return artifact.expires_at <= datetime.now(timezone.utc)

    async def _generate(
        self, feature_key: AIFeatureKey, input: AIArtifactInput
    ) -> AIResponse:
        handler_cls = ARTIFACT_HANDLERS.get(feature_key)
        if handler_cls is None:
            raise NotFoundError(f'AI feature {feature_key.value} has no handler')
        if not isinstance(input, handler_cls.input_schema):
            raise TypeError(
                f'Expected input of type {handler_cls.input_schema.__name__} '
                f'for feature {feature_key.value}, got {type(input).__name__}'
            )
        handler = handler_cls(self.session)
        return await handler.generate(input)

    async def _persist_artifact(
        self,
        artifact: AIArtifact | None,
        feature: AIFeature,
        input_hash: str,
        ai_response: AIResponse,
    ) -> AIArtifact:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=feature.default_ttl_hours)

        if artifact is None:
            artifact = AIArtifact(feature_id=feature.id, input_hash=input_hash)
            self.session.add(artifact)

        artifact.summary = ai_response.summary
        artifact.payload = ai_response.payload
        artifact.model = ai_response.model
        artifact.generated_at = now
        artifact.expires_at = expires_at

        await self.session.commit()
        await self.session.refresh(artifact)
        return artifact

    @staticmethod
    def _build_response(
        feature_key: AIFeatureKey,
        input: AIArtifactInput,
        artifact: AIArtifact,
    ) -> dict[str, Any]:
        return {
            'feature_key': feature_key.value,
            **input.model_dump(),
            'summary': artifact.summary,
            'payload': artifact.payload,
            'model': artifact.model,
            'generated_at': artifact.generated_at,
            'expires_at': artifact.expires_at,
        }

    @staticmethod
    def _hash_input(input: AIArtifactInput) -> str:
        canonical = input.model_dump_json()
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
