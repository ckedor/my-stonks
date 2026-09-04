import base64
from types import SimpleNamespace

import pytest

from app.infra.openai.openai_client import OpenAIProvider
from app.modules.ai.domain.provider import AIFileInput, AIGenerationRequest


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


@pytest.mark.asyncio
async def test_generate_attaches_a_document_and_asks_for_json():
    """Com arquivo o input vira mensagem: é o único lugar onde ele cabe."""
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    await provider.generate(
        AIGenerationRequest(
            prompt='extraia',
            model='gpt-4o',
            files=(
                AIFileInput(
                    filename='btg.pdf',
                    media_type='application/pdf',
                    content=b'%PDF-1.7',
                ),
            ),
            json_output=True,
        )
    )

    kwargs = provider._client.responses.kwargs
    assert kwargs['model'] == 'gpt-4o'
    assert kwargs['text'] == {'format': {'type': 'json_object'}}
    (message,) = kwargs['input']
    text_part, file_part = message['content']
    assert message['role'] == 'user'
    assert text_part == {'type': 'input_text', 'text': 'extraia'}
    assert file_part == {
        'type': 'input_file',
        'filename': 'btg.pdf',
        'file_data': 'data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.7').decode('ascii'),
    }


@pytest.mark.asyncio
async def test_generate_without_files_keeps_the_plain_prompt():
    """O caminho comum não paga pela existência do outro."""
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    await provider.generate(AIGenerationRequest(prompt='entrada'))

    kwargs = provider._client.responses.kwargs
    assert kwargs['input'] == 'entrada'
    assert 'text' not in kwargs
