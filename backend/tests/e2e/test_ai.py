"""A descrição de um ativo, do banco até a tela, com o modelo dublado.

Entra por HTTP de propósito: o que este arquivo prova é o que só a montagem
inteira responde — o schema `ai` que a migration cria com a feature e o prompt
já semeados, a identidade do artefato que inclui a versão do prompt, e o
registro de execução que acontece na fronteira do provider. O provedor de IA é
o único dublê.
"""

import json
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import text

ANSWER = {
    'summary': 'Uma ação preferencial da Petrobras.',
    'description': 'Exploração e refino de petróleo. Sem histórico suficiente para medir.',
    'sources': [
        {'title': 'Balanço', 'url': 'https://fonte.example/balanco'},
        {'title': 'Inventada', 'url': 'https://inventado.example/nao-existe'},
    ],
}

#: O provider lê as citações das anotações, e não do texto: é isso que separa
#: uma página que a busca visitou de uma URL que o modelo escreveu de memória.
FETCHED_URL = 'https://fonte.example/balanco'


class FakeResponses:
    def __init__(self, payload: dict):
        self.payload = payload
        self.calls: list[dict] = []

    def _response(self, kwargs):
        self.calls.append(kwargs)
        annotation = SimpleNamespace(type='url_citation', url=FETCHED_URL, title='Fonte')
        content = SimpleNamespace(annotations=[annotation])
        return SimpleNamespace(
            output_text=json.dumps(self.payload),
            output=[SimpleNamespace(content=[content])],
            usage=SimpleNamespace(input_tokens=1_200, output_tokens=340),
        )

    async def create(self, **kwargs):
        return self._response(kwargs)

    async def parse(self, **kwargs):
        return self._response(kwargs)


class FakeOpenAIClient:
    responses_spy: FakeResponses | None = None

    def __init__(self, *_args, **_kwargs):
        self.responses = FakeResponses(ANSWER)
        FakeOpenAIClient.responses_spy = self.responses

    async def close(self):
        pass


@pytest_asyncio.fixture
async def fake_openai():
    from app.infra.ai.factory import get_ai_provider

    get_ai_provider.cache_clear()
    FakeOpenAIClient.responses_spy = None
    with patch('app.infra.ai.openai_provider.AsyncOpenAI', FakeOpenAIClient):
        yield FakeOpenAIClient
    get_ai_provider.cache_clear()


@pytest_asyncio.fixture
async def asset_id(factory):
    return await factory.asset(ticker='PETR4', name='Petrobras PN')


async def _describe(client, asset_id):
    response = await client.get('/ai/asset_description_draft', params={'asset_id': asset_id})
    assert response.status_code == HTTPStatus.OK, response.text
    return response.json()


async def test_the_first_read_generates_and_the_second_comes_from_storage(
    client, fake_openai, asset_id
):
    first = await _describe(client, asset_id)
    assert first['from_cache'] is False
    assert first['payload']['summary'] == ANSWER['summary']
    assert len(fake_openai.responses_spy.calls) == 1

    second = await _describe(client, asset_id)
    assert second['from_cache'] is True
    assert len(fake_openai.responses_spy.calls) == 1, 'a segunda leitura não deve custar nada'


async def test_a_link_the_search_never_fetched_does_not_reach_the_reader(
    client, fake_openai, asset_id
):
    described = await _describe(client, asset_id)

    assert {source['url'] for source in described['payload']['sources']} == {FETCHED_URL}


async def test_the_prompt_carries_the_registry_and_the_measured_numbers(
    client, fake_openai, asset_id
):
    await _describe(client, asset_id)

    sent = fake_openai.responses_spy.calls[0]['input']
    assert 'PETR4' in sent
    assert 'DESEMPENHO' in sent
    # Sem cotação ingerida, os números têm de aparecer como não medidos em vez
    # de o prompt omitir a seção — é o que instrui o modelo a não inventá-los.
    assert 'não medido' in sent


async def test_a_manual_feature_stores_no_expiry(client, fake_openai, asset_id, db):
    await _describe(client, asset_id)

    expires_at = (await db.execute(text('SELECT expires_at FROM ai.ai_artifact'))).scalar_one()
    assert expires_at is None


async def test_the_call_is_recorded_with_its_tokens_and_cost(client, fake_openai, asset_id, db):
    await _describe(client, asset_id)

    row = (
        await db.execute(
            text(
                'SELECT label, provider, input_tokens, output_tokens, cost_usd, status '
                'FROM ai.ai_run'
            )
        )
    ).one()
    assert row.label == 'asset_description_draft'
    assert row.provider == 'openai'
    assert (row.input_tokens, row.output_tokens) == (1_200, 340)
    assert row.cost_usd > 0
    assert row.status == 'success'


async def test_running_the_feature_from_the_admin_replaces_the_stored_answer(
    client, fake_openai, asset_id
):
    await _describe(client, asset_id)

    response = await client.post(
        '/ai/feature/asset_description_draft/run', json={'asset_id': asset_id}
    )

    assert response.status_code == HTTPStatus.OK, response.text
    body = response.json()
    assert body['from_cache'] is False
    assert body['cost_usd'] > 0
    assert len(fake_openai.responses_spy.calls) == 2


async def test_activating_a_new_prompt_version_retires_the_stored_answer(
    client, fake_openai, asset_id
):
    """A correção central em relação à primeira versão do módulo."""
    await _describe(client, asset_id)

    created = await client.post(
        '/ai/feature/asset_description_draft/prompt_version',
        json={
            'system': 'Descreva.',
            'template': 'Fale de {ticker} em {today}.',
            'model': 'gpt-4o',
            'activate': True,
        },
    )
    assert created.status_code == HTTPStatus.OK, created.text
    assert created.json()['version'] == 2

    described = await _describe(client, asset_id)
    assert described['from_cache'] is False
    assert described['prompt_version'] == 2


async def test_a_prompt_naming_data_nobody_assembles_is_refused(client):
    response = await client.post(
        '/ai/feature/asset_description_draft/prompt_version',
        json={
            'template': 'Fale de {ticker} com dividend yield de {dividend_yield}.',
            'model': 'gpt-4o',
        },
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert 'dividend_yield' in response.json()['message']


async def test_the_admin_reads_the_form_of_a_feature_it_was_never_told_about(client):
    response = await client.get('/ai/feature/asset_description_draft/form')

    assert response.status_code == HTTPStatus.OK, response.text
    body = response.json()
    assert 'asset_id' in body['input_schema']['properties']
    assert 'ticker' in body['context_keys']


async def test_a_feature_with_an_incoherent_freshness_is_refused(client):
    response = await client.patch(
        '/ai/feature/asset_description_draft',
        json={'name': 'Descrição do ativo', 'freshness': 'manual', 'ttl_hours': 24},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_switching_the_feature_to_time_based_starts_stamping_an_expiry(
    client, fake_openai, asset_id, db
):
    patched = await client.patch(
        '/ai/feature/asset_description_draft',
        json={'name': 'Descrição do ativo', 'freshness': 'time', 'ttl_hours': 24},
    )
    assert patched.status_code == HTTPStatus.OK, patched.text

    await _describe(client, asset_id)

    expires_at = (await db.execute(text('SELECT expires_at FROM ai.ai_artifact'))).scalar_one()
    assert expires_at is not None


async def test_the_usage_screen_reports_what_was_spent(client, fake_openai, asset_id):
    await _describe(client, asset_id)

    response = await client.get('/ai/usage')

    assert response.status_code == HTTPStatus.OK, response.text
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]['label'] == 'asset_description_draft'
    assert rows[0]['runs'] == 1


@pytest.mark.parametrize('asset_id_value', [999_999])
async def test_an_unknown_asset_is_a_not_found(client, fake_openai, asset_id_value):
    response = await client.get('/ai/asset_description_draft', params={'asset_id': asset_id_value})

    assert response.status_code == HTTPStatus.NOT_FOUND
