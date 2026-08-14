import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.ai.domain.entities import AIArtifact, AIFeature
from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.domain.inputs import AIArtifactInput
from app.modules.ai.domain.provider import AIProvider
from app.modules.ai.service.handlers import ARTIFACT_HANDLERS, AIResponse


class AIArtifactService:
    def __init__(
        self,
        uow: UnitOfWork,
        provider: AIProvider,
    ):
        self.uow = uow
        self.provider = provider

    async def get_or_generate_artifact(
        self,
        feature_key: AIFeatureKey,
        input: AIArtifactInput,
        force_generate: bool = False,
    ) -> dict[str, Any]:
        input_hash = self._hash_input(input)
        async with self.uow as uow:
            feature = await uow.repository.get(AIFeature, by={'key': feature_key.value}, first=True)
            if feature is None:
                raise NotFoundError(f'AI feature {feature_key.value} is not configured')
            feature_id = feature.id
            feature_ttl_hours = feature.default_ttl_hours
            artifact = await uow.repository.get(
                AIArtifact,
                by={'feature_id': feature_id, 'input_hash': input_hash},
                first=True,
            )

        if self._needs_generation(artifact, force_generate):
            ai_response = await self._generate(feature_key, input)
            artifact = await self._persist_artifact(
                feature_id=feature_id,
                feature_ttl_hours=feature_ttl_hours,
                input_hash=input_hash,
                ai_response=ai_response,
            )

        return self._build_response(feature_key, input, artifact)

    @staticmethod
    def _needs_generation(artifact: AIArtifact | None, force_generate: bool) -> bool:
        if artifact is None or force_generate:
            return True
        return artifact.expires_at <= datetime.now(UTC)

    async def _generate(self, feature_key: AIFeatureKey, input: AIArtifactInput) -> AIResponse:
        handler_cls = ARTIFACT_HANDLERS.get(feature_key)
        if handler_cls is None:
            raise NotFoundError(f'AI feature {feature_key.value} has no handler')
        if not isinstance(input, handler_cls.input_schema):
            raise TypeError(
                f'Expected input of type {handler_cls.input_schema.__name__} '
                f'for feature {feature_key.value}, got {type(input).__name__}'
            )
        handler = handler_cls(self.provider)
        return await handler.generate(input)

    async def _persist_artifact(
        self,
        *,
        feature_id: int,
        feature_ttl_hours: int,
        input_hash: str,
        ai_response: AIResponse,
    ) -> AIArtifact:
        now = datetime.now(UTC)
        expires_at = now + timedelta(hours=feature_ttl_hours)

        async with self.uow as uow:
            persisted_artifact = await uow.repository.get(
                AIArtifact,
                by={'feature_id': feature_id, 'input_hash': input_hash},
                first=True,
            )
            if persisted_artifact is None:
                persisted_artifact = AIArtifact(feature_id=feature_id, input_hash=input_hash)
                await uow.repository.create(AIArtifact, [persisted_artifact])

            persisted_artifact.summary = ai_response.summary
            persisted_artifact.payload = ai_response.payload
            persisted_artifact.model = ai_response.model
            persisted_artifact.generated_at = now
            persisted_artifact.expires_at = expires_at
            await uow.commit()
            return persisted_artifact

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
