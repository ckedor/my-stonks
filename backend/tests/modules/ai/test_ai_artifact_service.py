"""Ler ou gerar — e sobretudo, quando NÃO gerar.

Os dois defeitos da primeira versão do módulo estão cobertos aqui: um artefato
continuava sendo servido depois de o prompt mudar, e o payload não era validado
contra schema nenhum.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import BaseModel, ConfigDict

from app.core.exceptions import NotFoundError
from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult
from app.infra.exceptions import IntegrationBadResponse
from app.modules.ai.domain.entities import AIArtifact, AIFeature, AIPromptVersion
from app.modules.ai.domain.enums import AIFreshness
from app.modules.ai.service.ai_artifact_service import AIArtifactService
from app.modules.ai.service.handlers.base import AIFeatureHandler
from tests.fakes import FakeUnitOfWork

pytestmark = pytest.mark.unit

FEATURE_KEY = 'sample'


class SampleInput(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')

    asset_id: int


class SampleOutput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    summary: str


class SampleHandler(AIFeatureHandler[SampleInput]):
    feature_key = FEATURE_KEY
    input_model = SampleInput
    output_model = SampleOutput
    schema_version = 2
    context_keys = frozenset({'ticker'})

    async def build_context(self, input: SampleInput) -> dict[str, Any]:
        return {'ticker': f'ASSET{input.asset_id}'}


@dataclass
class FakeProvider:
    text: str = '{"summary": "descrição"}'
    calls: list[AIGenerationRequest] = field(default_factory=list)

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        self.calls.append(request)
        return AIGenerationResult(
            text=self.text, model='gpt-4o', provider='openai', input_tokens=10, output_tokens=5
        )

    async def aclose(self) -> None: ...


class FakeAIRepository:
    def __init__(self, feature: AIFeature, version: AIPromptVersion, artifact=None):
        self.feature = feature
        self.version = version
        self.artifact = artifact
        self.written: list[AIArtifact] = []

    async def get_feature_by_key(self, key):
        return self.feature if self.feature and self.feature.key == key else None

    async def get_active_prompt_version(self, feature_id):
        return self.version

    async def get_artifact(self, *, feature_id, prompt_version_id, input_hash):
        if self.artifact is None:
            return None
        matches = (
            self.artifact.feature_id == feature_id
            and self.artifact.prompt_version_id == prompt_version_id
            and self.artifact.input_hash == input_hash
        )
        return self.artifact if matches else None

    async def upsert_artifact(self, artifact):
        self.written.append(artifact)
        return artifact


def _feature(freshness=AIFreshness.MANUAL, ttl_hours=None) -> AIFeature:
    return AIFeature(id=1, key=FEATURE_KEY, name='Sample', freshness=freshness, ttl_hours=ttl_hours)


def _version(version=1) -> AIPromptVersion:
    return AIPromptVersion(
        id=10 + version,
        feature_id=1,
        version=version,
        template='Fale de {ticker}',
        model='gpt-4o',
        is_active=True,
    )


def _service(repository, provider=None):
    return AIArtifactService(
        uow=FakeUnitOfWork(ai=repository),
        provider=provider or FakeProvider(),
        handlers={FEATURE_KEY: SampleHandler()},
    )


def _stored(version: AIPromptVersion, *, input_hash: str, **overrides) -> AIArtifact:
    defaults = {
        'feature_id': 1,
        'prompt_version_id': version.id,
        'input_hash': input_hash,
        'payload': {'summary': 'guardado'},
        'schema_version': 2,
        'model': 'gpt-4o',
        'generated_at': datetime.now(UTC) - timedelta(days=30),
        'expires_at': None,
    }
    return AIArtifact(**{**defaults, **overrides})


def _hash(asset_id: int = 7) -> str:
    return AIArtifactService._hash(SampleInput(asset_id=asset_id))


async def test_a_current_artifact_is_returned_without_calling_the_model():
    version = _version()
    repository = FakeAIRepository(_feature(), version, _stored(version, input_hash=_hash()))
    provider = FakeProvider()

    reading = await _service(repository, provider).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.payload == {'summary': 'guardado'}
    assert reading.from_cache is True
    assert provider.calls == [], 'uma resposta vigente não deve custar uma chamada'


async def test_a_manual_feature_never_expires_on_its_own():
    version = _version()
    ancient = _stored(
        version,
        input_hash=_hash(),
        generated_at=datetime.now(UTC) - timedelta(days=900),
        expires_at=None,
    )
    provider = FakeProvider()

    reading = await _service(
        FakeAIRepository(_feature(), version, ancient), provider
    ).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.from_cache is True
    assert provider.calls == []


async def test_an_expired_artifact_is_regenerated():
    version = _version()
    expired = _stored(
        version, input_hash=_hash(), expires_at=datetime.now(UTC) - timedelta(hours=1)
    )
    provider = FakeProvider()

    reading = await _service(
        FakeAIRepository(_feature(AIFreshness.TIME, 24), version, expired), provider
    ).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.from_cache is False
    assert len(provider.calls) == 1


async def test_activating_a_new_prompt_version_retires_the_previous_answers():
    """O pior defeito da v1: o prompt não fazia parte da identidade do artefato,
    e um deploy que o mudasse continuava servindo a resposta velha."""
    old_version = _version(1)
    stored = _stored(old_version, input_hash=_hash())
    active = _version(2)
    provider = FakeProvider()

    reading = await _service(
        FakeAIRepository(_feature(), active, stored), provider
    ).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.from_cache is False
    assert len(provider.calls) == 1
    assert reading.prompt_version == 2


async def test_an_artifact_written_under_an_older_schema_is_ignored():
    version = _version()
    stale = _stored(version, input_hash=_hash(), schema_version=1)
    provider = FakeProvider()

    reading = await _service(
        FakeAIRepository(_feature(), version, stale), provider
    ).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.from_cache is False


async def test_generate_always_replaces_a_current_answer():
    version = _version()
    repository = FakeAIRepository(_feature(), version, _stored(version, input_hash=_hash()))
    provider = FakeProvider()

    reading = await _service(repository, provider).generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.from_cache is False
    assert len(provider.calls) == 1
    assert repository.written[0].payload == {'summary': 'descrição'}


async def test_a_time_based_feature_stamps_an_expiry():
    version = _version()
    repository = FakeAIRepository(_feature(AIFreshness.TIME, 24), version)

    reading = await _service(repository).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.expires_at is not None


async def test_a_manual_feature_stamps_no_expiry():
    version = _version()
    repository = FakeAIRepository(_feature(), version)

    reading = await _service(repository).get_or_generate(FEATURE_KEY, {'asset_id': 7})

    assert reading.expires_at is None


async def test_the_prompt_reaches_the_provider_rendered_with_the_context():
    provider = FakeProvider()

    await _service(FakeAIRepository(_feature(), _version()), provider).get_or_generate(
        FEATURE_KEY, {'asset_id': 7}
    )

    assert provider.calls[0].prompt == 'Fale de ASSET7'
    assert provider.calls[0].output_schema is SampleOutput


async def test_the_trace_names_the_feature_and_the_prompt_version():
    provider = FakeProvider()
    version = _version()

    await _service(FakeAIRepository(_feature(), version), provider).get_or_generate(
        FEATURE_KEY, {'asset_id': 7}
    )

    trace = provider.calls[0].trace
    assert trace.label == FEATURE_KEY
    assert trace.prompt_version_id == version.id


async def test_an_answer_that_does_not_match_the_schema_is_refused():
    provider = FakeProvider(text='{"resumo": "campo errado"}')

    with pytest.raises(IntegrationBadResponse):
        await _service(FakeAIRepository(_feature(), _version()), provider).get_or_generate(
            FEATURE_KEY, {'asset_id': 7}
        )


async def test_an_unregistered_feature_is_a_not_found():
    repository = FakeAIRepository(None, _version())

    with pytest.raises(NotFoundError):
        await _service(repository).get_or_generate(FEATURE_KEY, {'asset_id': 7})


async def test_a_feature_without_an_active_prompt_version_is_a_not_found():
    repository = FakeAIRepository(_feature(), None)

    with pytest.raises(NotFoundError):
        await _service(repository).get_or_generate(FEATURE_KEY, {'asset_id': 7})
