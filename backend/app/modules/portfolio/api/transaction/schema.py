from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class Transaction(BaseModel):
    portfolio_id: int
    asset_id: int
    broker_id: int
    date: datetime
    quantity: float
    price: float
    currency: Literal['BRL', 'USD'] = 'BRL'
    settlement_date: date | None = None
    fees: float | None = None
    withheld_income_tax: float | None = None
    id: int | None = None
