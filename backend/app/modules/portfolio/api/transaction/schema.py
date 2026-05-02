from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class Transaction(BaseModel):
    portfolio_id: int
    asset_id: int
    broker_id: int
    date: datetime
    quantity: float
    price: float
    currency: Literal['BRL', 'USD'] = 'BRL'
    id: Optional[int] = None
