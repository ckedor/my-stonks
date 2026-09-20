from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FundRegistryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registry_id: int
    cnpj: str
    name: str
    kind: str
    status: str
    started_at: date | None
    cancelled_at: date | None
    administrator_name: str | None
    administrator_cnpj: str | None
    manager_name: str | None
    manager_document: str | None
    refreshed_at: datetime | None


class FundRegistryClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    registry_id: int
    fund_registry_id: int
    cnpj: str
    name: str
    class_type: str | None
    status: str | None
    classification: str | None
    anbima_classification: str | None
    open_ended: bool | None
    exclusive: bool | None
    target_investors: str | None
    long_term_taxation: bool | None
    custodian_name: str | None
    auditor_name: str | None
    equity: float | None
    equity_date: date | None
    admin_fee: float | None
    performance_fee: float | None
    performance_benchmark: str | None
    minimum_investment: float | None
    conversion_days: int | None
    redemption_payment_days: int | None
    terms_date: date | None
    refreshed_at: datetime | None
    fund: FundRegistryOut | None


class FundRegistrySubclassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fund_registry_class_id: int
    code: str
    name: str
    status: str | None
    target_investors: str | None
    pension: bool | None


class FundShareSeriesAliasOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fund_share_series_id: int
    label: str
    valid_from: date | None
    valid_to: date | None
    confirmed_at: datetime | None


class FundShareSeriesOut(BaseModel):
    id: int
    name: str
    aliases: list[FundShareSeriesAliasOut]


class RegisteredFundUnitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    fund_registry_subclass_id: int | None
    fund_share_series_id: int | None


class FundRegistryClassDetailOut(BaseModel):
    registry_class: FundRegistryClassOut
    subclasses: list[FundRegistrySubclassOut]
    series: list[FundShareSeriesOut]
    registered_units: list[RegisteredFundUnitOut]


class FundSeriesCandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str
    shares: float | None
    share_value: float | None
    has_shares: bool


class FundSeriesFilingOut(BaseModel):
    """The latest FIDC filing of a class. ``applicable`` is false for classes
    that do not file by series; ``filing_date`` is null when no file listed by
    the source has a filing for the class."""

    model_config = ConfigDict(from_attributes=True)

    fund_registry_class_id: int
    applicable: bool
    filing_date: date | None
    candidates: list[FundSeriesCandidateOut]
    searched_from: date | None
    searched_to: date | None
    files_read: int


class RegisterFundRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    fund_registry_class_id: int
    asset_type_id: int
    fund_registry_subclass_id: int | None = None
    #: An existing series of the class, or the label a new one is filed under.
    series_id: int | None = None
    series_label: str | None = Field(default=None, max_length=100)
    name: str | None = Field(default=None, max_length=200)


class SeriesAliasIn(BaseModel):
    model_config = ConfigDict(extra='forbid')

    label: str = Field(min_length=1, max_length=100)
    valid_from: date | None = None
    valid_to: date | None = None


class SelectFundSeriesRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    series_id: int | None = None
    series_label: str | None = Field(default=None, max_length=100)


class ConfirmSeriesAliasesRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    aliases: list[SeriesAliasIn] = Field(min_length=1)
