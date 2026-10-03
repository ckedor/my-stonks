from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.portfolio.domain.brokerage_note import (
    AssetMatch,
    GroupAction,
    GroupDecision,
    GroupStatus,
    NoteAmounts,
    NoteHeader,
    NoteLine,
)


class _FromAttributes(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class NoteWarningResponse(_FromAttributes):
    code: str
    message: str


class DraftLineResponse(_FromAttributes):
    index: int
    side: Literal['C', 'V']
    market: str | None
    security: str
    ticker: str | None
    #: O ISIN impresso na linha, quando válido: é por ele que casa um ETF
    #: listado fora dos EUA.
    isin: str | None
    quantity: float
    price: float
    value: float
    fees: float
    withheld_income_tax: float | None
    asset_id: int | None
    asset_name: str | None
    match: AssetMatch


class NoteAmountsSchema(_FromAttributes):
    """Totais, custos e líquido como a nota os imprime; os custos, positivos."""

    purchases_total: float | None = None
    sales_total: float | None = None
    operations_total: float | None = None
    settlement_fee: float | None = None
    registration_fee: float | None = None
    emoluments: float | None = None
    other_exchange_fees: float | None = None
    brokerage: float | None = None
    iss: float | None = None
    other_costs: float | None = None
    withheld_income_tax: float | None = None
    net_amount: float | None = None

    def to_domain(self) -> NoteAmounts:
        return NoteAmounts(**self.model_dump())


class LineRefResponse(_FromAttributes):
    note_index: int
    line_index: int


class ReconciliationGroupResponse(_FromAttributes):
    key: str
    status: GroupStatus
    default_action: GroupAction
    actions: list[GroupAction]
    broker_id: int | None
    asset_id: int | None
    trade_date: date
    side: Literal['C', 'V']
    lines: list[LineRefResponse]
    existing_ids: list[int]
    message: str | None
    warnings: list[str]


class DraftNoteResponse(_FromAttributes):
    index: int
    broker_name: str
    broker_cnpj: str | None
    broker_id: int | None
    currency: Literal['BRL', 'USD']
    note_number: str | None
    trade_date: date
    settlement_date: date | None
    amounts: NoteAmountsSchema
    fees: float
    warnings: list[NoteWarningResponse]
    lines: list[DraftLineResponse]
    groups: list[ReconciliationGroupResponse]
    #: Esta nota (mesma corretora e número) já foi importada na carteira.
    imported_note_id: int | None
    imported_at: datetime | None


class BrokerageNoteDraftResponse(_FromAttributes):
    notes: list[DraftNoteResponse]
    model: str | None
    #: O PDF enviado, guardado. Nulo quando não há storage configurado.
    document_id: int | None


class NoteLineRequest(BaseModel):
    """Uma linha como a pessoa a conferiu: o ativo e a corretora já escolhidos, ou não."""

    note_index: int
    line_index: int
    broker_id: int | None
    asset_id: int | None
    trade_date: date
    settlement_date: date | None
    side: Literal['C', 'V']
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    fees: float | None = None
    withheld_income_tax: float | None = None
    currency: Literal['BRL', 'USD'] = 'BRL'

    def to_domain(self) -> NoteLine:
        return NoteLine(**self.model_dump())


class ReconciliationRequest(BaseModel):
    portfolio_id: int
    lines: list[NoteLineRequest]


class GroupDecisionRequest(BaseModel):
    key: str
    action: GroupAction
    #: As transações que a pessoa viu no grupo. Se a carteira não tiver mais
    #: exatamente essas, a decisão foi tomada sobre outra coisa.
    existing_ids: list[int]

    def to_domain(self) -> GroupDecision:
        return GroupDecision(
            key=self.key, action=self.action, existing_ids=tuple(self.existing_ids)
        )


class NoteHeaderRequest(BaseModel):
    broker_id: int | None
    currency: Literal['BRL', 'USD'] = 'BRL'
    note_number: str | None = Field(default=None, max_length=40)
    trade_date: date
    settlement_date: date | None
    amounts: NoteAmountsSchema
    #: O documento de onde a nota foi lida, como a leitura o devolveu.
    document_id: int | None = None

    def to_domain(self) -> NoteHeader:
        return NoteHeader(
            broker_id=self.broker_id,
            currency=self.currency,
            note_number=self.note_number,
            trade_date=self.trade_date,
            settlement_date=self.settlement_date,
            amounts=self.amounts.to_domain(),
            document_id=self.document_id,
        )


class ImportRequest(ReconciliationRequest):
    """Uma nota por vez: o cabeçalho que será gravado, as linhas e as decisões."""

    note: NoteHeaderRequest
    decisions: list[GroupDecisionRequest]


class ImportResponse(_FromAttributes):
    note_id: int
    created: int
    updated: int
    deleted: int
    asset_ids: list[int]


class BrokerageNoteResponse(BaseModel):
    """Uma nota importada, para o histórico."""

    id: int
    broker_id: int
    broker_name: str
    currency: Literal['BRL', 'USD']
    note_number: str | None
    trade_date: date
    settlement_date: date | None
    operations_total: float | None
    fees: float
    withheld_income_tax: float | None
    net_amount: float | None
    document_id: int | None
    imported_at: datetime
    transaction_count: int
