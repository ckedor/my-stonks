from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.modules.portfolio.domain.document import DocumentKind


class _FromAttributes(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DocumentNoteResponse(_FromAttributes):
    id: int
    broker_name: str
    note_number: str | None
    trade_date: date


class PortfolioDocumentResponse(_FromAttributes):
    """Um arquivo enviado à carteira, para o histórico."""

    id: int
    kind: DocumentKind
    filename: str
    size_bytes: int
    uploaded_at: datetime
    #: As notas de corretagem confirmadas a partir deste documento.
    notes: list[DocumentNoteResponse]
