"""A carteira recomendada entra por um PDF e sai do banco conferida.

Entra por HTTP de propósito: o que este arquivo tem a provar é o que só a
montagem inteira responde — o schema `research` que a migration cria, o
mapeamento que grava as posições junto da edição, e a extração que não escreve
nada. O provedor de IA é o único dublê.
"""

import json
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy import text

PDF = b'%PDF-1.7 relatorio de agosto'

REPORT = {
    'source_name': 'BTG Pactual',
    'title': 'Carteira Recomendada de FIIs',
    'reference_date': '2026-08-01',
    'summary': 'Juros em queda favorecem tijolo.',
    'objective': 'Renda mensal com FIIs líquidos.',
    'positions': [
        {
            'ticker': 'XPML11',
            'name': 'XP Malls',
            'weight': '12,5%',
            'target_price': 'R$ 118,40',
            'rationale': 'Shoppings maduros.',
            'change': 'increased',
        },
        {'ticker': 'AUSENTE11', 'weight': 7.5},
    ],
}


class FakeResponses:
    def __init__(self, text):
        self.text = text
        self.kwargs = None

    async def create(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(output_text=self.text)


class FakeOpenAIClient:
    def __init__(self, *_args, **_kwargs):
        self.responses = FakeResponses(json.dumps(REPORT))

    async def close(self):
        pass


@pytest_asyncio.fixture
async def fake_openai():
    """O provedor é o único dublê, e ele entra pelo cliente da OpenAI.

    Assim o caminho do provider — a mensagem com o documento anexado em base64
    — roda de verdade, e o teste continua sem chamar ninguém de fora.
    """
    from app.infra.openai.openai_client import get_ai_provider

    get_ai_provider.cache_clear()
    with patch('app.infra.openai.openai_client.AsyncOpenAI', FakeOpenAIClient):
        yield
    get_ai_provider.cache_clear()


async def _extract(client) -> dict:
    response = await client.post(
        '/research/recommended_portfolio/extraction',
        files={'file': ('btg.pdf', PDF, 'application/pdf')},
    )
    assert response.status_code == HTTPStatus.OK, response.text
    return response.json()


def _payload(draft: dict, **overrides) -> dict:
    body = {
        'source_name': draft['source_name'],
        'title': draft['title'],
        'reference_date': draft['reference_date'],
        'summary': draft['summary'],
        'objective': draft['objective'],
        'positions': [
            {
                'ticker': position['ticker'],
                'asset_id': position['asset_id'],
                'name': position['name'],
                'weight': position['weight'],
                'rationale': position['rationale'],
                'target_price': position['target_price'],
                'change': position['change'],
            }
            for position in draft['positions']
        ],
    }
    return body | overrides


async def test_extraction_links_the_ticker_and_writes_nothing(client, factory, fake_openai, db):
    asset_id = await factory.asset(ticker='XPML11', name='XP Malls')

    draft = await _extract(client)

    assert draft['title'] == 'Carteira Recomendada de FIIs'
    assert draft['total_weight'] == 20.0
    xpml, ausente = draft['positions']
    assert (xpml['asset_id'], xpml['match']) == (asset_id, 'matched')
    assert xpml['weight'] == 12.5
    assert xpml['target_price'] == 118.40
    # A linha sem cadastro fica: descartá-la mudaria o peso da que ficou.
    assert (ausente['asset_id'], ausente['match']) == (None, 'unknown')

    kept = await db.scalar(text('SELECT count(*) FROM research.recommended_portfolio'))
    assert kept == 0


async def test_confirming_the_draft_creates_the_edition_and_its_lines(
    client, factory, fake_openai, db
):
    asset_id = await factory.asset(ticker='XPML11', name='XP Malls')
    draft = await _extract(client)

    response = await client.post('/research/recommended_portfolio', json=_payload(draft))

    assert response.status_code == HTTPStatus.OK, response.text
    created = response.json()
    assert created['source']['name'] == 'BTG Pactual'
    assert created['source']['slug'] == 'btg-pactual'
    assert created['reference_date'] == '2026-08-01'
    assert {(p['ticker'], p['asset_id'], p['weight']) for p in created['positions']} == {
        ('XPML11', asset_id, 12.5),
        ('AUSENTE11', None, 7.5),
    }

    listed = await client.get('/research/recommended_portfolio')
    assert [item['id'] for item in listed.json()] == [created['id']]

    sources = await client.get('/research/source')
    assert [source['slug'] for source in sources.json()] == ['btg-pactual']


async def test_the_same_edition_twice_is_a_conflict(client, fake_openai):
    """Subir o mesmo PDF de novo é o engano fácil desta tela."""
    draft = await _extract(client)
    await client.post('/research/recommended_portfolio', json=_payload(draft))

    response = await client.post('/research/recommended_portfolio', json=_payload(draft))

    assert response.status_code == HTTPStatus.CONFLICT


async def test_another_month_is_another_edition_of_the_same_carteira(client, fake_openai):
    draft = await _extract(client)
    await client.post('/research/recommended_portfolio', json=_payload(draft))

    response = await client.post(
        '/research/recommended_portfolio',
        json=_payload(draft, reference_date='2026-09-01'),
    )

    assert response.status_code == HTTPStatus.OK, response.text


async def test_deleting_the_edition_takes_its_lines(client, fake_openai, db):
    draft = await _extract(client)
    created = (await client.post('/research/recommended_portfolio', json=_payload(draft))).json()

    response = await client.delete(f'/research/recommended_portfolio/{created["id"]}')

    assert response.status_code == HTTPStatus.OK
    remaining = await db.scalar(text('SELECT count(*) FROM research.recommended_position'))
    assert remaining == 0
    assert (await client.get(f'/research/recommended_portfolio/{created["id"]}')).status_code == (
        HTTPStatus.NOT_FOUND
    )


@pytest.mark.parametrize(
    'content',
    [b'', b'PK\x03\x04 isto e um zip'],
    ids=['vazio', 'não é PDF'],
)
async def test_a_file_that_is_not_a_pdf_is_refused_as_such(client, fake_openai, content):
    """A recusa chega como recusa, e não como falha de integração."""
    response = await client.post(
        '/research/recommended_portfolio/extraction',
        files={'file': ('btg.pdf', content, 'application/pdf')},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
