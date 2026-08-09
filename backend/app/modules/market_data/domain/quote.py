from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd

CLOSE_PRICES_DF_COLUMNS = ['date', 'close', 'currency']


@dataclass(frozen=True)
class AssetSnapshot:
    id: int
    ticker: str
    asset_type_id: int
    exchange: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> 'AssetSnapshot':
        return cls(
            id=int(data['id']),
            ticker=data['ticker'],
            asset_type_id=int(data['asset_type_id']),
            exchange=data.get('exchange'),
        )


@dataclass(eq=False, kw_only=True)
class Quote:
    id: int | None = None
    date: date
    open: Decimal | float | None = None
    close: Decimal | float | None
    high: Decimal | float | None = None
    low: Decimal | float | None = None
    adjusted_close: Decimal | float | None = None
    volume: Decimal | float | None = None
    asset_id: int | None = None
    currency_id: int | None = None
    source: str = 'unknown'
    updated_at: datetime | None = None


@dataclass(frozen=True)
class FetchedQuotes:
    ticker: str
    currency: str | None
    source: str
    parameters: dict[str, Any]
    quotes: list[Quote] = field(default_factory=list)
    #: Provider-hosted brand image for the ticker, when it offers one.
    logo_url: str | None = None


@dataclass(frozen=True)
class AssetQuoteIngestionResult:
    asset_id: int
    ticker: str
    status: str
    source: str
    fetched_rows: int = 0
    upserted_rows: int = 0
    error: str | None = None


@dataclass(frozen=True)
class QuoteIngestionResult:
    assets: list[AssetQuoteIngestionResult]

    @property
    def total_assets(self) -> int:
        return len(self.assets)

    @property
    def succeeded_assets(self) -> int:
        return sum(item.status == 'success' for item in self.assets)

    @property
    def failed_assets(self) -> int:
        return sum(item.status == 'failure' for item in self.assets)

    @property
    def fetched_rows(self) -> int:
        return sum(item.fetched_rows for item in self.assets)

    @property
    def upserted_rows(self) -> int:
        return sum(item.upserted_rows for item in self.assets)


def persisted_close_prices_df(quotes: Sequence['Quote']) -> pd.DataFrame:
    """Daily close prices in the quote's own currency, forward-filled up to today.

    Quotes without a close price are ignored. Returns an empty frame when none
    of them carries a close, so callers can report missing history explicitly
    instead of silently falling back to a provider.
    """
    # ``close`` arrives as Decimal from the database. The frames it is combined
    # with (exchange rates, computed prices) are float, and Decimal does not
    # support arithmetic with float, so normalize here rather than at each use.
    rows = [
        {'date': quote.date, 'close': float(quote.close), 'currency': quote.currency_id}
        for quote in quotes
        if quote.close is not None
    ]
    if not rows:
        return pd.DataFrame(columns=CLOSE_PRICES_DF_COLUMNS)

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    full_range = pd.DataFrame({
        'date': pd.date_range(start=df['date'].min(), end=datetime.today(), freq='D')
    })
    df = pd.merge(full_range, df, on='date', how='left')
    df['close'] = df['close'].ffill()
    df['currency'] = df['currency'].ffill()
    return df[CLOSE_PRICES_DF_COLUMNS]
