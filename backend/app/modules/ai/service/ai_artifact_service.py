import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable

from app.core.exceptions import NotFoundError
from app.infra.db.models.ai_artifact import AIArtifact
from app.infra.db.models.ai_feature import AIFeature
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.openai.openai_client import OpenAIClient
from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.domain.prompts import build_asset_overview_and_news_prompt

AIResponse = dict[str, Any]
ArtifactBuilder = Callable[['AIArtifactService', dict[str, Any]], Awaitable[AIResponse]]


class AIArtifactService:
    def __init__(self, session):
        self.session = session
        self.repo = SQLAlchemyRepository(session)
        self.openai_client = OpenAIClient()

    async def get_or_generate_artifact(
        self,
        feature_key: AIFeatureKey,
        input_payload: dict[str, Any],
        force_generate: bool = False,
    ) -> dict[str, Any]:
        feature = await self._load_feature(feature_key)
        input_hash = self._hash_payload(input_payload)
        artifact = await self._find_artifact(feature.id, input_hash)

        if self._needs_generation(artifact, force_generate):
            ai_response = await self._generate(feature_key, input_payload)
            artifact = await self._persist_artifact(
                artifact=artifact,
                feature=feature,
                input_hash=input_hash,
                ai_response=ai_response,
            )

        return self._build_response(feature_key, input_payload, artifact)

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

    async def _generate(self, feature_key: AIFeatureKey, input_payload: dict[str, Any]) -> AIResponse:
        builder = self._ARTIFACT_BUILDERS.get(feature_key)
        if builder is None:
            raise NotFoundError(f'AI feature {feature_key.value} has no handler')
        return await builder(self, input_payload)

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

        artifact.summary = ai_response.get('summary')
        artifact.payload = ai_response.get('payload')
        artifact.model = ai_response.get('model')
        artifact.generated_at = now
        artifact.expires_at = expires_at

        await self.session.commit()
        await self.session.refresh(artifact)
        return artifact

    @staticmethod
    def _build_response(
        feature_key: AIFeatureKey,
        input_payload: dict[str, Any],
        artifact: AIArtifact,
    ) -> dict[str, Any]:
        return {
            'feature_key': feature_key.value,
            'ticker': str(input_payload.get('ticker', '')),
            'summary': artifact.summary,
            'payload': artifact.payload,
            'model': artifact.model,
            'generated_at': artifact.generated_at,
            'expires_at': artifact.expires_at,
        }

    async def _build_asset_overview_and_news_artifact(self, input_payload: dict[str, Any]) -> AIResponse:
        prompt = build_asset_overview_and_news_prompt(ticker=str(input_payload['ticker']))
        text = await self.openai_client.ask(
            prompt=prompt.prompt,
            system=prompt.system,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens,
        )
        return {
            'summary': prompt.summary,
            'payload': {'text': text},
            'model': self.openai_client.model,
        }

    _ARTIFACT_BUILDERS: dict[AIFeatureKey, ArtifactBuilder] = {
        AIFeatureKey.ASSET_OVERVIEW_AND_NEWS: _build_asset_overview_and_news_artifact,
    }

    @staticmethod
    def _hash_payload(payload: dict[str, Any]) -> str:
        canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()
