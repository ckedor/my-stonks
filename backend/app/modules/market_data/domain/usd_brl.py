from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import pandas as pd

USD_BRL_DF_COLUMNS = ['date', 'usd_brl', 'brl_usd']

#: Decimal places kept for the inverted rate. It sits around 0.19, so it needs
#: more places than ``usd_brl`` to carry the same relative precision: the round
#: trip holds to ~3e-12 for post-Real rates. Only the hyperinflation-era rates
#: in the tens of thousands (1986-1993) lose enough places to reach ~3e-8.
BRL_USD_DECIMAL_PLACES = 12


@dataclass(eq=False, kw_only=True)
class UsdBrlHistory:
    """The canonical exchange rate for one date, in both directions.

    ``usd_brl`` is the BRL value of one USD; ``brl_usd`` is its inverse. Both
    are persisted so that consumers convert by multiplying, never dividing.
    """

    date: date
    usd_brl: Decimal
    brl_usd: Decimal
    source: str
    id: int | None = None


def invert_rate(usd_brl: Decimal) -> Decimal:
    """Return the BRL→USD rate matching a USD→BRL one, ready to persist."""
    if usd_brl <= 0:
        raise ValueError('USD/BRL rate must be greater than zero')
    return round(Decimal(1) / Decimal(usd_brl), BRL_USD_DECIMAL_PLACES)


def usd_brl_history_to_payload(history: Sequence[UsdBrlHistory]) -> list[dict]:
    return [
        {
            'date': item.date.isoformat(),
            'usd_brl': float(item.usd_brl),
            'brl_usd': float(item.brl_usd),
        }
        for item in history
    ]


def usd_brl_history_to_df(history: Sequence[UsdBrlHistory]) -> pd.DataFrame:
    """Rate history as a DataFrame with ``date`` (datetime), ``usd_brl``, ``brl_usd``."""
    payload = usd_brl_history_to_payload(history)
    if not payload:
        return pd.DataFrame(columns=USD_BRL_DF_COLUMNS)
    df = pd.DataFrame(payload)
    df['date'] = pd.to_datetime(df['date'])
    return df


def convert_usd_to_brl(amount: Decimal, usd_brl: Decimal) -> Decimal:
    return amount * usd_brl


def convert_brl_to_usd(amount: Decimal, brl_usd: Decimal) -> Decimal:
    if brl_usd <= 0:
        raise ValueError('BRL/USD rate must be greater than zero')
    return amount * brl_usd
