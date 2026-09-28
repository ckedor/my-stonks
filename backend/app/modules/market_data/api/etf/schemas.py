from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class EtfLegalEntity(BaseModel):
    name: str
    lei: str | None
    cnpj: str | None
    country: str | None


class EtfFund(BaseModel):
    name: str
    lei: str | None
    sec_series_id: str | None
    domicile: str
    status: str
    tracks_index: bool | None
    leveraged_or_inverse: bool | None
    fund_of_funds: bool | None
    umbrella: EtfLegalEntity | None
    managers: list[EtfLegalEntity]


class EtfShareClass(BaseModel):
    name: str
    ticker: str | None
    isin: str | None
    sec_class_id: str | None
    currency: str | None
    distribution_policy: Literal['accumulating', 'distributing', 'mixed'] | None
    cfi_code: str | None
    status: str


class EtfCvmFund(BaseModel):
    cnpj: str
    name: str
    status: str
    started_at: date | None
    administrator_name: str | None
    manager_name: str | None


class EtfHoldingReportSummary(BaseModel):
    report_date: date
    source: str
    net_assets: float | None
    total_assets: float | None
    holdings_count: int
    fetched_at: datetime | None


class EtfProfileResponse(BaseModel):
    #: Which regulator registers it: `sec`, `esma`, `cvm`, or nobody yet.
    registry: Literal['sec', 'esma', 'cvm'] | None
    fund: EtfFund | None
    share_class: EtfShareClass | None
    cvm_fund: EtfCvmFund | None
    holdings: EtfHoldingReportSummary | None
    #: Whether a regulator publishes what this ETF holds.
    holdings_available: bool


class EtfHoldingResponse(BaseModel):
    rank: int
    name: str
    isin: str | None
    ticker: str | None
    asset_id: int | None
    asset_category: str | None
    country: str | None
    currency: str | None
    balance: float | None
    units: str | None
    value_usd: float | None
    #: Of the fund's net assets, as a ratio: 0.08 is 8%.
    weight: float | None


class EtfHoldingsPageResponse(BaseModel):
    report_date: date | None
    source: str | None
    total: int
    page: int
    page_size: int
    items: list[EtfHoldingResponse]
