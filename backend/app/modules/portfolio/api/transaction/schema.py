from datetime import datetime
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
    id: int | None = None
