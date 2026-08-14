"""Broker schemas."""

from pydantic import BaseModel, ConfigDict

from app.modules.market_data.api.currency.schemas import Currency


class BrokerCreate(BaseModel):
    name: str
    cnpj: str | None = None
    currency_id: int


class BrokerUpdate(BaseModel):
    name: str | None = None
    cnpj: str | None = None
    currency_id: int | None = None


class Broker(BaseModel):
    id: int
    currency: Currency
    name: str
    cnpj: str | None

    model_config = ConfigDict(from_attributes=True)
