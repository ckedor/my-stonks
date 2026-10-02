import hashlib
from collections import defaultdict

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.storage.document_storage import DocumentStorage
from app.modules.portfolio.domain.document import (
    PDF_CONTENT_TYPE,
    DocumentContent,
    DocumentKind,
    DocumentNote,
    DocumentSummary,
    storage_key,
)
from app.modules.portfolio.domain.entities import PortfolioDocument


class PortfolioDocumentService:
    """Guarda os arquivos enviados à carteira e os devolve depois.

    Os bytes vão para o storage e os metadados para o banco. Sem storage
    configurado nada é guardado, e `store` diz isso devolvendo None — quem
    envia continua sendo lido. Com storage, falhar em guardar falha o envio:
    um histórico com buracos que ninguém vê seria pior que um erro.
    """

    def __init__(self, uow: UnitOfWork, storage: DocumentStorage | None):
        self.uow = uow
        self.storage = storage

    async def store(
        self, *, portfolio_id: int, kind: DocumentKind, filename: str, content: bytes
    ) -> int | None:
        """Guarda o arquivo e devolve o id do documento; o mesmo conteúdo é o mesmo documento."""
        if self.storage is None:
            return None
        digest = hashlib.sha256(content).hexdigest()
        key = storage_key(portfolio_id, kind, digest)
        # O storage vem antes do banco, e fora da transação: a chave sai do
        # conteúdo, então repetir o envio regrava o mesmo objeto.
        await self.storage.put(key, content, content_type=PDF_CONTENT_TYPE)
        async with self.uow as uow:
            existing = await uow.portfolios.find_document(portfolio_id, kind.value, digest)
            if existing is not None:
                return existing.id
            (document_id,) = await uow.portfolios.create(
                PortfolioDocument,
                {
                    'portfolio_id': portfolio_id,
                    'kind': kind.value,
                    'filename': filename[:255],
                    'content_type': PDF_CONTENT_TYPE,
                    'size_bytes': len(content),
                    'sha256': digest,
                    'storage_key': key,
                },
            )
            await uow.commit()
        return document_id

    async def list_documents(self, portfolio_id: int) -> list[DocumentSummary]:
        async with self.uow as uow:
            documents = await uow.portfolios.list_documents(portfolio_id)
            linked = await uow.portfolios.list_document_notes(portfolio_id)
        notes: dict[int, list[DocumentNote]] = defaultdict(list)
        for note in linked:
            notes[note['document_id']].append(
                DocumentNote(
                    id=note['id'],
                    broker_name=note['broker_name'],
                    note_number=note['note_number'],
                    trade_date=note['trade_date'],
                )
            )
        return [
            DocumentSummary(
                id=document.id,
                kind=DocumentKind(document.kind),
                filename=document.filename,
                size_bytes=document.size_bytes,
                uploaded_at=document.uploaded_at,
                notes=tuple(notes[document.id]),
            )
            for document in documents
        ]

    async def read(self, *, portfolio_id: int, document_id: int) -> DocumentContent:
        async with self.uow as uow:
            document = await uow.portfolios.get_document(portfolio_id, document_id)
        if document is None:
            raise NotFoundError('Documento não encontrado nesta carteira.')
        if self.storage is None:
            raise BusinessRuleError('O storage de documentos não está configurado.')
        content = await self.storage.get(document.storage_key)
        return DocumentContent(
            filename=document.filename, content_type=document.content_type, content=content
        )

    async def delete_portfolio_documents(self, portfolio_id: int) -> None:
        """Apaga os documentos de uma carteira que vai ser apagada.

        Os objetos saem antes das linhas: se o storage falhar no meio, as
        linhas que sobraram ainda dizem o que falta apagar, e repetir termina.
        """
        async with self.uow as uow:
            documents = await uow.portfolios.list_documents(portfolio_id)
            if not documents:
                return
            if self.storage is not None:
                for document in documents:
                    await self.storage.delete(document.storage_key)
            await uow.portfolios.delete(PortfolioDocument, by={'portfolio_id': portfolio_id})
            await uow.commit()
