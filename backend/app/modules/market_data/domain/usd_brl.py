from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(eq=False, kw_only=True)
class UsdBrlHistory:
    date: date
    usd_to_brl_rate: Decimal
    source: str
    id: int | None = None


def convert_usd_to_brl(amount: Decimal, usd_to_brl_rate: Decimal) -> Decimal:
    return amount * usd_to_brl_rate


def convert_brl_to_usd(amount: Decimal, usd_to_brl_rate: Decimal) -> Decimal:
    if usd_to_brl_rate <= 0:
        raise ValueError('USD/BRL rate must be greater than zero')
    return amount / usd_to_brl_rate
