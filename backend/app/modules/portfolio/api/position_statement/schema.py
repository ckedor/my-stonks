from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.portfolio.domain.brokerage_note import AssetMatch
from app.modules.portfolio.domain.position_statement import PositionMatch, StatementHolding


class _FromAttributes(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class StatementWarningResponse(_FromAttributes):
    code: str
    message: str


class DraftHoldingResponse(_FromAttributes):
    index: int
    security: str
    ticker: str | None
    quantity: float
    asset_id: int | None
    asset_name: str | None
    match: AssetMatch


class PositionDiffResponse(_FromAttributes):
    key: str
    status: PositionMatch
    asset_id: int | None
    statement_quantity: float | None
    app_quantity: float | None
    difference: float | None
    holdings: list[int]


class PositionStatementDraftResponse(_FromAttributes):
    broker_name: str
    broker_cnpj: str | None
    broker_id: int | None
    currency: Literal['BRL', 'USD']
    as_of: date
    holdings: list[DraftHoldingResponse]
    positions: list[PositionDiffResponse]
    warnings: list[StatementWarningResponse]
    model: str | None


class StatementHoldingRequest(BaseModel):
    index: int
    security: str = ''
    ticker: str | None = None
    quantity: float = Field(ge=0)
    asset_id: int | None

    def to_domain(self) -> StatementHolding:
        return StatementHolding(**self.model_dump())


class PositionComparisonRequest(BaseModel):
    portfolio_id: int
    broker_id: int
    as_of: date
    holdings: list[StatementHoldingRequest]
