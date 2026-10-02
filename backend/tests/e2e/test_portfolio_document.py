"""O documento guardado aparece no histórico, volta byte a byte, e a nota aponta para ele.

O envio em si passa pelo modelo e está coberto pelos testes dos services. O que
só o banco e as rotas respondem é a migration, a unicidade por conteúdo, o
vínculo da nota e a recusa de entregar o arquivo a outra carteira.
"""

from http import HTTPStatus

import pytest
from sqlalchemy import text

from app.composition.portfolio import build_portfolio_document_service
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.document import DocumentKind
from tests.fakes import InMemoryDocumentStorage

PDF = b'%PDF-1.7 nota de corretagem'
PREGAO = '2026-09-01'


@pytest.fixture
def storage(monkeypatch):
    storage = InMemoryDocumentStorage()
    monkeypatch.setattr('app.composition.portfolio.get_document_storage', lambda: storage)
    return storage


async def _store(portfolio_id, kind=DocumentKind.BROKERAGE_NOTE, content=PDF) -> int:
    service = build_portfolio_document_service(UnitOfWork())
    return await service.store(
        portfolio_id=portfolio_id, kind=kind, filename='nota setembro.pdf', content=content
    )


async def test_a_kept_document_is_listed_and_comes_back_as_it_was_sent(client, factory, storage):
    portfolio_id = await factory.portfolio()
    document_id = await _store(portfolio_id)

    listed = await client.get('/portfolio/document', params={'portfolio_id': portfolio_id})
    assert listed.status_code == HTTPStatus.OK, listed.text
    (document,) = listed.json()
    assert (document['id'], document['kind'], document['filename'], document['size_bytes']) == (
        document_id,
        'brokerage_note',
        'nota setembro.pdf',
        len(PDF),
    )
    assert document['notes'] == []

    content = await client.get(
        f'/portfolio/document/{document_id}/content', params={'portfolio_id': portfolio_id}
    )
    assert content.status_code == HTTPStatus.OK, content.text
    assert content.content == PDF
    assert content.headers['content-type'] == 'application/pdf'
    assert 'nota%20setembro.pdf' in content.headers['content-disposition']


async def test_the_same_file_twice_is_one_document_and_another_purpose_is_another(
    client, factory, storage
):
    portfolio_id = await factory.portfolio()

    first = await _store(portfolio_id)
    again = await _store(portfolio_id)
    as_statement = await _store(portfolio_id, kind=DocumentKind.POSITION_STATEMENT)

    assert first == again
    assert as_statement != first
    listed = await client.get('/portfolio/document', params={'portfolio_id': portfolio_id})
    assert sorted(d['kind'] for d in listed.json()) == ['brokerage_note', 'position_statement']
    assert len(storage.objects) == 2


async def test_a_document_is_not_served_to_another_portfolio(client, factory, storage):
    portfolio_id = await factory.portfolio()
    other_id = await factory.portfolio(name='Outra')
    document_id = await _store(portfolio_id)

    response = await client.get(
        f'/portfolio/document/{document_id}/content', params={'portfolio_id': other_id}
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


async def test_a_confirmed_note_points_at_the_document_it_was_read_from(client, factory, storage):
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    asset_id = await factory.asset(ticker='PETR4')
    document_id = await _store(portfolio_id)
    body = {
        'portfolio_id': portfolio_id,
        'lines': [
            {
                'note_index': 0,
                'line_index': 0,
                'broker_id': broker_id,
                'asset_id': asset_id,
                'trade_date': PREGAO,
                'settlement_date': '2026-09-03',
                'side': 'C',
                'quantity': 100,
                'price': 30.0,
                'fees': 0.24,
                'withheld_income_tax': None,
            }
        ],
    }
    groups = (await client.post('/portfolio/brokerage_note/reconciliation', json=body)).json()

    response = await client.post(
        '/portfolio/brokerage_note',
        json=body
        | {
            'note': {
                'broker_id': broker_id,
                'note_number': '21862',
                'trade_date': PREGAO,
                'settlement_date': '2026-09-03',
                'amounts': {'operations_total': 3000.0, 'net_amount': -3000.24},
                'document_id': document_id,
            },
            'decisions': [
                {'key': g['key'], 'action': g['default_action'], 'existing_ids': g['existing_ids']}
                for g in groups
            ],
        },
    )
    assert response.status_code == HTTPStatus.OK, response.text

    history = await client.get('/portfolio/brokerage_note', params={'portfolio_id': portfolio_id})
    (note,) = history.json()
    assert note['document_id'] == document_id

    listed = await client.get('/portfolio/document', params={'portfolio_id': portfolio_id})
    (document,) = listed.json()
    assert [(n['id'], n['note_number']) for n in document['notes']] == [(note['id'], '21862')]


async def test_deleting_the_portfolio_takes_its_documents_and_their_files(
    client, factory, storage, db
):
    portfolio_id = await factory.portfolio()
    await _store(portfolio_id)

    response = await client.delete(f'/portfolio/{portfolio_id}')

    assert response.status_code == HTTPStatus.OK, response.text
    assert storage.objects == {}
    remaining = await db.scalar(
        text('SELECT count(*) FROM portfolio.document WHERE portfolio_id = :p'),
        {'p': portfolio_id},
    )
    assert remaining == 0


async def test_without_a_storage_nothing_is_kept(client, factory, monkeypatch):
    monkeypatch.setattr('app.composition.portfolio.get_document_storage', lambda: None)
    portfolio_id = await factory.portfolio()

    assert await _store(portfolio_id) is None

    listed = await client.get('/portfolio/document', params={'portfolio_id': portfolio_id})
    assert listed.json() == []
