import datetime as dt

from pydantic import BaseModel, ConfigDict, model_validator

from app.modules.portfolio.domain.dividend import DividendQuery


class DividendFilters(BaseModel):
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    asset_id: int | None = None
    asset_type_ids: list[int] | None = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode='after')
    def check_dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError('start_date must be <= end_date')
        return self

    def to_domain(self) -> DividendQuery:
        return DividendQuery(
            start_date=self.start_date,
            end_date=self.end_date,
            asset_id=self.asset_id,
            asset_type_ids=self.asset_type_ids,
        )


class DividendCreateRequest(BaseModel):
    portfolio_id: int
    asset_id: int
    date: dt.date | None = None
    amount: float


class DividendUpdateRequest(BaseModel):
    id: int
    date: dt.date | None = None
    amount: float | None = None


class Dividend(BaseModel):
    id: int
    date: dt.date
    asset_id: int
    ticker: str
    amount: float
    category: str | None = None
    model_config = ConfigDict(from_attributes=True)
