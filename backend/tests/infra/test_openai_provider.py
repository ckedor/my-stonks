import base64
from types import SimpleNamespace

import pytest

from app.infra.ai.openai_provider import OpenAIProvider
from app.infra.ai.provider import AIFileInput, AIGenerationRequest
from app.infra.exceptions import IntegrationBadResponse


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


@pytest.mark.parametrize('model', ['gpt-5', 'o1', 'o3-mini', 'o4-mini'])
@pytest.mark.asyncio
async def test_generate_omits_temperature_for_reasoning_models(model):
    """Mandar `temperature` para esses modelos é 400, não um valor ignorado."""
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    await provider.generate(AIGenerationRequest(prompt='entrada', model=model, temperature=0.2))

    assert 'temperature' not in provider._client.responses.kwargs


@pytest.mark.asyncio
async def test_generate_keeps_temperature_for_the_other_models():
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    await provider.generate(AIGenerationRequest(prompt='entrada', model='gpt-4o', temperature=0.7))

    assert provider._client.responses.kwargs['temperature'] == 0.7


class EmptyResponses:
    """O provedor respondendo sem texto, como responde quando estoura o teto."""

    def __init__(self, response):
        self._response = response

    async def create(self, **kwargs):
        self.kwargs = kwargs
        return self._response


def _client_answering(response):
    client = FakeOpenAIClient()
    client.responses = EmptyResponses(response)
    return client


@pytest.mark.asyncio
async def test_empty_answer_by_output_cap_says_so_and_names_the_cap():
    """Sem isso, gastar o teto raciocinando chegava como 'empty response'."""
    provider = OpenAIProvider()
    provider._client = _client_answering(
        SimpleNamespace(
            output_text='',
            status='incomplete',
            incomplete_details=SimpleNamespace(reason='max_output_tokens'),
            max_output_tokens=4000,
            usage=SimpleNamespace(
                input_tokens=900,
                output_tokens=4000,
                output_tokens_details=SimpleNamespace(reasoning_tokens=4000),
            ),
        )
    )

    with pytest.raises(IntegrationBadResponse) as raised:
        await provider.generate(AIGenerationRequest(prompt='entrada', model='gpt-5'))

    message = str(raised.value)
    assert 'gpt-5' in message
    assert '4000' in message
    assert 'raciocinando' in message


@pytest.mark.asyncio
async def test_empty_answer_without_a_stated_reason_still_reports_the_status():
    provider = OpenAIProvider()
    provider._client = _client_answering(
        SimpleNamespace(output_text='', status='completed', incomplete_details=None)
    )

    with pytest.raises(IntegrationBadResponse) as raised:
        await provider.generate(AIGenerationRequest(prompt='entrada', model='gpt-4o'))

    assert 'completed' in str(raised.value)


@pytest.mark.asyncio
async def test_generate_without_files_keeps_the_plain_prompt():
    """O caminho comum não paga pela existência do outro."""
    provider = OpenAIProvider()
    provider._client = FakeOpenAIClient()

    await provider.generate(AIGenerationRequest(prompt='entrada'))

    kwargs = provider._client.responses.kwargs
    assert kwargs['input'] == 'entrada'
    assert 'text' not in kwargs
