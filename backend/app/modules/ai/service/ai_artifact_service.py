import hashlib
import json
from datetime import UTC, datetime

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.infra.ai.provider import (
    AIGenerationRequest,
    AIGenerationResult,
    AIProvider,
    TraceContext,
)
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.exceptions import IntegrationBadResponse
from app.modules.ai.domain.entities import AIArtifact, AIFeature, AIPromptVersion
from app.modules.ai.domain.enums import AIFeatureKey
from app.modules.ai.domain.pricing import calculate_cost_usd
from app.modules.ai.domain.prompt_template import render
from app.modules.ai.domain.readings import AIArtifactReading
from app.modules.ai.service.handlers.base import AIFeatureHandler


class AIArtifactService:
    """Reads an answer, and generates one when there is none to read.

    Everything here is the same for every feature. What differs — the input, the
    answer's shape, the data the application has to assemble — lives in the
    handler, which is why adding a feature adds no code to this file.
    """

    def __init__(
        self,
        *,
        uow: UnitOfWork,
        provider: AIProvider,
        handlers: dict[AIFeatureKey, AIFeatureHandler],
    ):
        self.uow = uow
        self.provider = provider
        self.handlers = handlers

    async def get_or_generate(self, feature_key: str, payload: dict) -> AIArtifactReading:
        """The product path: read what is stored, generate only if nothing is.

        It never regenerates a current answer. Replacing one is a decision
        somebody makes, and it enters through ``generate``.
        """
        return await self._resolve(feature_key, payload, force=False)

    async def generate(self, feature_key: str, payload: dict) -> AIArtifactReading:
        """The refresh: always calls the model and replaces what was stored."""
        return await self._resolve(feature_key, payload, force=True)

    async def _resolve(self, feature_key: str, payload: dict, *, force: bool) -> AIArtifactReading:
        handler = self._handler(feature_key)
        model_input = self._validate_input(handler, payload)
        input_hash = self._hash(model_input)

        async with self.uow as uow:
            feature = await uow.ai.get_feature_by_key(feature_key)
            if feature is None:
                raise NotFoundError(f'A feature de IA "{feature_key}" não está cadastrada')
            if not feature.enabled:
                raise BusinessRuleError(f'A feature de IA "{feature_key}" está desligada')
            version = await uow.ai.get_active_prompt_version(feature.id)
            if version is None:
                raise NotFoundError(
                    f'A feature de IA "{feature_key}" não tem versão de prompt ativa'
                )
            stored = await uow.ai.get_artifact(
                feature_id=feature.id,
                prompt_version_id=version.id,
                input_hash=input_hash,
            )

        if not force and stored is not None and stored.is_current(handler.schema_version):
            return self._reading_from(feature_key, stored, version, from_cache=True)

        output, result = await self._generate_output(handler, feature, version, model_input)
        artifact = self._build_artifact(
            feature=feature,
            version=version,
            input_hash=input_hash,
            model_input=model_input,
            output=output,
            result=result,
            schema_version=handler.schema_version,
        )

        async with self.uow as uow:
            await uow.ai.upsert_artifact(artifact)
            await uow.commit()

        return self._reading_from(feature_key, artifact, version, from_cache=False, result=result)

    async def _generate_output(
        self,
        handler: AIFeatureHandler,
        feature: AIFeature,
        version: AIPromptVersion,
        model_input: BaseModel,
    ) -> tuple[BaseModel, AIGenerationResult]:
        context = await handler.build_context(model_input)
        result = await self.provider.generate(
            AIGenerationRequest(
                prompt=render(version.template, context),
                system=version.system,
                model=version.model,
                temperature=version.temperature,
                max_output_tokens=version.max_output_tokens,
                output_schema=handler.output_model,
                web_search=version.web_search,
                trace=TraceContext(
                    label=feature.key,
                    feature_id=feature.id,
                    prompt_version_id=version.id,
                ),
            )
        )
        output = self._validate_output(handler, result)
        return handler.refine(output, result.citations), result

    def _handler(self, feature_key: str) -> AIFeatureHandler:
        handler = self.handlers.get(feature_key)
        if handler is None:
            raise NotFoundError(f'A feature de IA "{feature_key}" não tem handler')
        return handler

    @staticmethod
    def _validate_input(handler: AIFeatureHandler, payload: dict) -> BaseModel:
        try:
            return handler.input_model.model_validate(payload or {})
        except PydanticValidationError as error:
            raise ValidationError(f'Entrada inválida para a feature: {error}') from error

    @staticmethod
    def _validate_output(handler: AIFeatureHandler, result: AIGenerationResult) -> BaseModel:
        """The answer is parsed against the schema even though it was enforced.

        Enforcement happens at the provider and covers the shape. This covers
        the case where it did not happen at all — a provider that ignored the
        schema, or a chain that fell through to one that does not support it.
        """
        try:
            return handler.output_model.model_validate_json(result.text)
        except PydanticValidationError as error:
            raise IntegrationBadResponse(
                provider=result.provider or 'ai',
                context={'reason': 'a resposta do modelo não tem o formato esperado'},
            ) from error

    @staticmethod
    def _hash(model_input: BaseModel) -> str:
        """The identity of an input, stable across key order and whitespace.

        The prompt version is not in here on purpose: it is a column of its own
        in the artifact's unique key, which is what makes activating a new
        version retire the old answers instead of colliding with them.
        """
        canonical = json.dumps(model_input.model_dump(mode='json'), sort_keys=True)
        return hashlib.sha256(canonical.encode()).hexdigest()

    @staticmethod
    def _build_artifact(  # noqa: PLR0913
        *,
        feature: AIFeature,
        version: AIPromptVersion,
        input_hash: str,
        model_input: BaseModel,
        output: BaseModel,
        result: AIGenerationResult,
        schema_version: int,
    ) -> AIArtifact:
        generated_at = datetime.now(UTC)
        return AIArtifact(
            feature_id=feature.id,
            prompt_version_id=version.id,
            input_hash=input_hash,
            input=model_input.model_dump(mode='json'),
            payload=output.model_dump(mode='json'),
            schema_version=schema_version,
            model=result.model,
            generated_at=generated_at,
            expires_at=feature.expiry_for(generated_at),
        )

    @staticmethod
    def _reading_from(
        feature_key: str,
        artifact: AIArtifact,
        version: AIPromptVersion,
        *,
        from_cache: bool,
        result: AIGenerationResult | None = None,
    ) -> AIArtifactReading:
        return AIArtifactReading(
            feature_key=feature_key,
            payload=artifact.payload,
            schema_version=artifact.schema_version,
            model=artifact.model,
            generated_at=artifact.generated_at,
            expires_at=artifact.expires_at,
            prompt_version=version.version,
            from_cache=from_cache,
            provider=result.provider if result else '',
            input_tokens=result.input_tokens if result else 0,
            output_tokens=result.output_tokens if result else 0,
            cost_usd=(
                calculate_cost_usd(result.model, result.input_tokens, result.output_tokens)
                if result
                else 0.0
            ),
            latency_ms=result.latency_ms if result else 0,
        )
