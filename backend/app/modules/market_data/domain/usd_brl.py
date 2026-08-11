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


def usd_brl_history_to_cache_payload(history: Sequence[UsdBrlHistory]) -> list[dict]:
    """The rate history in its cacheable form: JSON-native, no precision lost.

    Rates are carried as strings rather than floats so ``Decimal`` survives the
    round trip. Money conversions read them back as ``Decimal``, and ``brl_usd``
    keeps twelve decimal places -- more than a float literal reliably restores.
    """
    return [
        {
            'date': item.date.isoformat(),
            'usd_brl': str(item.usd_brl),
            'brl_usd': str(item.brl_usd),
            'source': item.source,
        }
        for item in history
    ]


def usd_brl_payload_slice(payload: Sequence[dict], start_date: date | None) -> list[dict]:
    """The entries from ``start_date`` onwards. ISO dates compare as strings."""
    if start_date is None:
        return list(payload)
    floor = start_date.isoformat()
    return [item for item in payload if item['date'] >= floor]


def usd_brl_payload_to_df(payload: Sequence[dict]) -> pd.DataFrame:
    """Rate history as a DataFrame with ``date`` (datetime), ``usd_brl``, ``brl_usd``.

    The rates become floats here: every consumer of this frame multiplies them
    into float price columns, and pandas has no Decimal arithmetic to preserve.
    """
    if not payload:
        return pd.DataFrame(columns=USD_BRL_DF_COLUMNS)
    df = pd.DataFrame([
        {
            'date': item['date'],
            'usd_brl': float(item['usd_brl']),
            'brl_usd': float(item['brl_usd']),
        }
        for item in payload
    ])
    df['date'] = pd.to_datetime(df['date'])
    return df


def usd_brl_history_to_df(history: Sequence[UsdBrlHistory]) -> pd.DataFrame:
    """Rate history as a DataFrame with ``date`` (datetime), ``usd_brl``, ``brl_usd``."""
    return usd_brl_payload_to_df(usd_brl_history_to_cache_payload(history))


def usd_brl_payload_entry_to_history(entry: dict) -> UsdBrlHistory:
    """Rebuild the domain entity from one cached entry, rates back as Decimal."""
    return UsdBrlHistory(
        date=date.fromisoformat(entry['date']),
        usd_brl=Decimal(entry['usd_brl']),
        brl_usd=Decimal(entry['brl_usd']),
        source=entry['source'],
    )


def find_rate_on_or_before(
    payload: Sequence[dict],
    target_date: date,
) -> UsdBrlHistory | None:
    """The rate in effect on ``target_date``, from an ascending payload.

    The rate is published on business days only, so a weekend or holiday takes
    the last one before it. Returns ``None`` when the history starts after the
    requested date -- callers decide whether that is an error.
    """
    ceiling = target_date.isoformat()
    for item in reversed(payload):
        if item['date'] <= ceiling:
            return usd_brl_payload_entry_to_history(item)
    return None


def convert_usd_to_brl(amount: Decimal, usd_brl: Decimal) -> Decimal:
    return amount * usd_brl


def convert_brl_to_usd(amount: Decimal, brl_usd: Decimal) -> Decimal:
    if brl_usd <= 0:
        raise ValueError('BRL/USD rate must be greater than zero')
    return amount * brl_usd
