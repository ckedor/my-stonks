"""O documento da carteira: o arquivo enviado, guardado como chegou.

O que se guarda é o arquivo, não o que foi lido dele. A leitura de uma nota
continua sem gravar transação alguma antes de alguém confirmar; o PDF é um
fato de outra ordem — ele foi enviado, e isso não depende de concordar com o
que o modelo leu nele.
"""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

PDF_CONTENT_TYPE = 'application/pdf'


class DocumentKind(StrEnum):
    """Para que o arquivo foi enviado. O mesmo PDF pode servir aos dois fins."""

    BROKERAGE_NOTE = 'brokerage_note'
    POSITION_STATEMENT = 'position_statement'


def storage_key(portfolio_id: int, kind: DocumentKind, sha256: str) -> str:
    """Onde o conteúdo mora no storage.

    Sai do conteúdo, não de um id: gravar duas vezes o mesmo arquivo cai na
    mesma chave, então um envio que falhou depois do storage e antes do banco
    não deixa objeto órfão — o próximo envio o reencontra.
    """
    return f'portfolio/{portfolio_id}/{kind.value}/{sha256}.pdf'


@dataclass(frozen=True, kw_only=True)
class DocumentNote:
    """Uma nota de corretagem confirmada a partir do documento."""

    id: int
    broker_name: str
    note_number: str | None
    trade_date: date


@dataclass(frozen=True, kw_only=True)
class DocumentSummary:
    """Um documento no histórico da carteira, com as notas que saíram dele."""

    id: int
    kind: DocumentKind
    filename: str
    size_bytes: int
    uploaded_at: datetime
    notes: tuple[DocumentNote, ...]


@dataclass(frozen=True, kw_only=True)
class DocumentContent:
    filename: str
    content_type: str
    content: bytes
