"""Broker schemas."""

from typing import Optional

from app.modules.market_data.api.index.schemas import Currency
from pydantic import BaseModel, ConfigDict


class BrokerCreate(BaseModel):
    name: str
    cnpj: Optional[str] = None
    currency_id: int


class BrokerUpdate(BaseModel):
    name: Optional[str] = None
    cnpj: Optional[str] = None
    currency_id: Optional[int] = None


class Broker(BaseModel):
    id: int
    currency: Currency
    name: str
    cnpj: Optional[str]

    model_config = ConfigDict(from_attributes=True)
