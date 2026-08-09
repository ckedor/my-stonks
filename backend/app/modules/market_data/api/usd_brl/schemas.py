from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class UsdBrlConversionRequest(BaseModel):
    amount: Decimal
    direction: Literal['usd_to_brl', 'brl_to_usd']
    date: date


class UsdBrlHistoryPoint(BaseModel):
    date: date
    usd_brl: Decimal
    brl_usd: Decimal
    source: str

    model_config = {'from_attributes': True}


class UsdBrlConversionResponse(BaseModel):
    amount: Decimal
    converted_amount: Decimal
    direction: str
    rate: Decimal
    rate_date: date
