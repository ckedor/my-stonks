"""O documento enviado é guardado uma vez por conteúdo, e só é devolvido à carteira dele."""

import hashlib
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.modules.portfolio.domain.document import DocumentKind, storage_key
from app.modules.portfolio.domain.entities import PortfolioDocument
from app.modules.portfolio.service.portfolio_document_service import PortfolioDocumentService
from tests.fakes import FakeUnitOfWork, InMemoryDocumentStorage

PDF = b'%PDF-1.7 nota'
DIGEST = hashlib.sha256(PDF).hexdigest()
PORTFOLIO = 1
KEY = storage_key(PORTFOLIO, DocumentKind.BROKERAGE_NOTE, DIGEST)


def _document(**overrides) -> PortfolioDocument:
    fields = {
        'id': 7,
        'portfolio_id': PORTFOLIO,
        'kind': 'brokerage_note',
        'filename': 'nota.pdf',
        'content_type': 'application/pdf',
        'size_bytes': len(PDF),
        'sha256': DIGEST,
        'storage_key': KEY,
        'uploaded_at': datetime(2026, 10, 1, tzinfo=UTC),
    }
    return PortfolioDocument(**(fields | overrides))


def _service(*, storage=None, **portfolios):
    defaults = {
        'find_document': AsyncMock(return_value=None),
        'get_document': AsyncMock(return_value=None),
        'list_documents': AsyncMock(return_value=[]),
        'list_document_notes': AsyncMock(return_value=[]),
        'create': AsyncMock(return_value=[7]),
        'delete': AsyncMock(),
    }
    uow = FakeUnitOfWork(portfolios=SimpleNamespace(**(defaults | portfolios)))
    return PortfolioDocumentService(uow=uow, storage=storage), uow


async def _store(service) -> int | None:
    return await service.store(
        portfolio_id=PORTFOLIO,
        kind=DocumentKind.BROKERAGE_NOTE,
        filename='nota.pdf',
        content=PDF,
    )


async def test_storing_puts_the_bytes_under_a_key_made_of_the_content():
    storage = InMemoryDocumentStorage()
    service, uow = _service(storage=storage)

    document_id = await _store(service)

    assert document_id == 7
    assert storage.objects == {KEY: PDF}
    model, fields = uow.portfolios.create.await_args.args
    assert model is PortfolioDocument
    assert (fields['sha256'], fields['storage_key'], fields['size_bytes']) == (
        DIGEST,
        KEY,
        len(PDF),
    )
    uow.commit.assert_awaited_once()


async def test_the_same_content_again_is_the_same_document():
    storage = InMemoryDocumentStorage()
    service, uow = _service(storage=storage, find_document=AsyncMock(return_value=_document()))

    document_id = await _store(service)

    assert document_id == 7
    uow.portfolios.create.assert_not_awaited()
    uow.commit.assert_not_awaited()


async def test_without_a_storage_nothing_is_kept_and_the_caller_is_told():
    service, uow = _service(storage=None)

    assert await _store(service) is None
    assert uow.entered == 0


async def test_a_storage_failure_fails_the_upload_before_any_row_exists():
    storage = SimpleNamespace(put=AsyncMock(side_effect=RuntimeError('bucket down')))
    service, uow = _service(storage=storage)

    with pytest.raises(RuntimeError):
        await _store(service)

    uow.portfolios.create.assert_not_awaited()


async def test_reading_returns_the_bytes_of_a_document_of_the_portfolio():
    storage = InMemoryDocumentStorage()
    storage.objects[KEY] = PDF
    service, uow = _service(storage=storage, get_document=AsyncMock(return_value=_document()))

    document = await service.read(portfolio_id=PORTFOLIO, document_id=7)

    assert (document.filename, document.content) == ('nota.pdf', PDF)
    uow.portfolios.get_document.assert_awaited_once_with(PORTFOLIO, 7)


async def test_a_document_of_another_portfolio_is_not_found():
    service, _ = _service(storage=InMemoryDocumentStorage())

    with pytest.raises(NotFoundError):
        await service.read(portfolio_id=PORTFOLIO, document_id=7)


async def test_reading_without_a_storage_says_why():
    service, _ = _service(storage=None, get_document=AsyncMock(return_value=_document()))

    with pytest.raises(BusinessRuleError, match='não está configurado'):
        await service.read(portfolio_id=PORTFOLIO, document_id=7)


async def test_the_history_groups_the_confirmed_notes_under_their_document():
    note = {
        'id': 3,
        'document_id': 7,
        'broker_name': 'Nu Investimentos',
        'note_number': '123',
        'trade_date': date(2026, 9, 1),
    }
    service, _ = _service(
        list_documents=AsyncMock(
            return_value=[_document(), _document(id=8, kind='position_statement')]
        ),
        list_document_notes=AsyncMock(return_value=[note]),
    )

    with_notes, without = await service.list_documents(PORTFOLIO)

    assert [n.note_number for n in with_notes.notes] == ['123']
    assert (without.kind, without.notes) == (DocumentKind.POSITION_STATEMENT, ())


async def test_deleting_a_portfolio_takes_the_objects_and_then_the_rows():
    storage = InMemoryDocumentStorage()
    storage.objects[KEY] = PDF
    service, uow = _service(storage=storage, list_documents=AsyncMock(return_value=[_document()]))

    await service.delete_portfolio_documents(PORTFOLIO)

    assert storage.objects == {}
    uow.portfolios.delete.assert_awaited_once_with(
        PortfolioDocument, by={'portfolio_id': PORTFOLIO}
    )
    uow.commit.assert_awaited_once()


async def test_a_storage_failure_while_deleting_leaves_the_rows_to_retry_from():
    storage = SimpleNamespace(delete=AsyncMock(side_effect=RuntimeError('bucket down')))
    service, uow = _service(storage=storage, list_documents=AsyncMock(return_value=[_document()]))

    with pytest.raises(RuntimeError):
        await service.delete_portfolio_documents(PORTFOLIO)

    uow.portfolios.delete.assert_not_awaited()
    uow.commit.assert_not_awaited()
