from types import SimpleNamespace

import pytest
from app.infra.openai.openai_client import OpenAIProvider
from app.modules.ai.domain.provider import AIGenerationRequest


class FakeResponses:
    async def create(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(output_text='resultado')


class FakeOpenAIClient:
    def __init__(self):
        self.responses = FakeResponses()

    async def close(self):
        pass


@pytest.mark.asyncio
async def test_generate_uses_responses_api():
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    result = await provider.generate(
        AIGenerationRequest(
            prompt='entrada',
            system='instruções',
            temperature=0.2,
            max_output_tokens=500,
        )
    )

    assert result.text == 'resultado'
    assert result.model == 'gpt-4o-mini'
    assert provider._client.responses.kwargs == {
        'model': 'gpt-4o-mini',
        'input': 'entrada',
        'instructions': 'instruções',
        'temperature': 0.2,
        'max_output_tokens': 500,
        'store': False,
    }
