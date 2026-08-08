from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any


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
