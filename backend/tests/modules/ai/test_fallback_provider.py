"""A cadeia de providers: quando ela anda, quando ela para, e com qual modelo.

O caso que importa negativamente é o `IntegrationBadResponse`: schema inválido
é defeito de prompt, e pedir de novo a outro modelo paga duas vezes pelo mesmo
defeito.
"""

from dataclasses import dataclass, field

import pytest

from app.infra.ai.fallback_provider import FallbackAIProvider, ProviderLink
from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
)

pytestmark = pytest.mark.unit


@dataclass
class FakeProvider:
    name: str
    error: Exception | None = None
    seen: list[AIGenerationRequest] = field(default_factory=list)
    closed: bool = False

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        self.seen.append(request)
        if self.error is not None:
            raise self.error
        return AIGenerationResult(
            text='{}', model=request.model or f'{self.name}-default', provider=self.name
        )

    async def aclose(self) -> None:
        self.closed = True


def _chain(first: FakeProvider, second: FakeProvider) -> FallbackAIProvider:
    return FallbackAIProvider([
        ProviderLink(name='openai', provider=first, model_prefixes=('gpt-',)),
        ProviderLink(name='anthropic', provider=second, model_prefixes=('claude-',)),
    ])


async def test_answers_from_the_first_link_when_it_works():
    first, second = FakeProvider('openai'), FakeProvider('anthropic')

    result = await _chain(first, second).generate(AIGenerationRequest(prompt='oi'))

    assert result.provider == 'openai'
    assert second.seen == []


async def test_moves_on_when_a_provider_could_not_answer():
    first = FakeProvider('openai', error=IntegrationRateLimited(provider='openai'))
    second = FakeProvider('anthropic')

    result = await _chain(first, second).generate(AIGenerationRequest(prompt='oi'))

    assert result.provider == 'anthropic'


async def test_moves_on_when_a_provider_refuses_for_lack_of_funds():
    first = FakeProvider(
        'openai', error=IntegrationError(provider='openai', status_code=402, retryable=False)
    )
    second = FakeProvider('anthropic')

    result = await _chain(first, second).generate(AIGenerationRequest(prompt='oi'))

    assert result.provider == 'anthropic'


async def test_does_not_move_on_when_the_answer_was_bad():
    first = FakeProvider('openai', error=IntegrationBadResponse(provider='openai'))
    second = FakeProvider('anthropic')

    with pytest.raises(IntegrationBadResponse):
        await _chain(first, second).generate(AIGenerationRequest(prompt='oi'))

    assert second.seen == [], 'um schema inválido não deve ser pago duas vezes'


async def test_the_link_that_owns_the_model_answers_first():
    first, second = FakeProvider('openai'), FakeProvider('anthropic')

    result = await _chain(first, second).generate(
        AIGenerationRequest(prompt='oi', model='claude-sonnet-5')
    )

    assert result.provider == 'anthropic'
    assert first.seen == []


async def test_a_fallen_through_request_asks_the_next_link_for_its_own_model():
    """Entregar `gpt-4o` à Anthropic falharia por um motivo alheio ao primeiro."""
    first = FakeProvider('openai', error=IntegrationRateLimited(provider='openai'))
    second = FakeProvider('anthropic')

    await _chain(first, second).generate(AIGenerationRequest(prompt='oi', model='gpt-4o'))

    assert first.seen[0].model == 'gpt-4o'
    assert second.seen[0].model is None


async def test_raises_the_last_failure_when_every_link_refused():
    first = FakeProvider('openai', error=IntegrationRateLimited(provider='openai'))
    second = FakeProvider('anthropic', error=IntegrationRateLimited(provider='anthropic'))

    with pytest.raises(IntegrationRateLimited) as error:
        await _chain(first, second).generate(AIGenerationRequest(prompt='oi'))

    assert error.value.provider == 'anthropic'


async def test_closing_the_chain_closes_every_link():
    first, second = FakeProvider('openai'), FakeProvider('anthropic')

    await _chain(first, second).aclose()

    assert first.closed
    assert second.closed
