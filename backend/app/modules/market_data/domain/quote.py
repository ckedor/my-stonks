from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import pandas as pd

from app.modules.market_data.domain.constants import CURRENCY

CLOSE_PRICES_DF_COLUMNS = ['date', 'close', 'currency']

#: Fields of a serialized quote that carry money and so follow the exchange
#: rate. ``volume`` is a share count and stays as it is.
QUOTE_PRICE_FIELDS = ('open', 'high', 'low', 'close', 'adjusted_close')


def convert_quotes_to_currency(
    quotes: Sequence[dict],
    rate_payload: Sequence[dict],
    *,
    target_currency_id: int,
    default_currency_id: int | None = None,
) -> list[dict]:
    """Serialized quotes with their prices restated in ``target_currency_id``.

    Prices are multiplied by the rate in effect on the quote's own date -- never
    divided, since the rate history persists both directions precisely so that
    no consumer has to invert it.

    The rate is published on business days only while a quote may fall on any
    day (cryptoassets trade at weekends), so the last rate on or before each
    date carries forward. Both sequences must be ascending by date, which is how
    the repository returns them.

    A quote is dropped rather than guessed at when it cannot be restated
    faithfully: when its date precedes the whole rate history, or when neither
    it nor ``default_currency_id`` says what currency it is already in. Callers
    compare lengths to report the loss.
    """
    if not quotes:
        return []

    converted: list[dict] = []
    rate_index = 0
    current: dict | None = None

    for quote in quotes:
        quote_date = quote['date']
        while rate_index < len(rate_payload) and rate_payload[rate_index]['date'] <= quote_date:
            current = rate_payload[rate_index]
            rate_index += 1

        source_currency_id = quote.get('currency_id') or default_currency_id
        if source_currency_id is None:
            continue
        if int(source_currency_id) == int(target_currency_id):
            converted.append({**quote, 'currency_id': int(target_currency_id)})
            continue
        if current is None:
            continue

        # Multiplying by the stored direction: USD priced in BRL uses usd_brl,
        # BRL priced in USD uses its precomputed inverse.
        factor = float(
            current['usd_brl'] if target_currency_id == CURRENCY.BRL else current['brl_usd']
        )
        restated = {**quote, 'currency_id': int(target_currency_id)}
        for field_name in QUOTE_PRICE_FIELDS:
            value = quote.get(field_name)
            if value is not None:
                restated[field_name] = value * factor
        converted.append(restated)

    return converted


#: The shortest history worth annualizing. Below a full year the exponent
#: amplifies whatever the last months did, and a number that swings with noise
#: reads as a fact -- so no number is served at all.
MIN_CAGR_DAYS = 365
DAYS_IN_YEAR = 365.25
#: A rate needs a price to start from and a price to end at.
MIN_CAGR_QUOTES = 2


@dataclass(frozen=True)
class HistoricalCagr:
    """Compound annual growth over the whole persisted history of an asset.

    ``start_date`` travels with the rate because the two are meaningless apart:
    the same percentage means very different things over three years and over
    thirty, and the reader can only tell from where the series begins.
    """

    value: float
    start_date: date
    end_date: date

    def to_dict(self) -> dict[str, Any]:
        return {
            'value': self.value,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
        }


def _quote_date(value: Any) -> date:
    return value if isinstance(value, date) else date.fromisoformat(str(value))


def historical_cagr(quotes: Sequence[dict]) -> HistoricalCagr | None:
    """Annualized growth between the first and last close of ``quotes``.

    Serialized quotes in, so the rate is computed on exactly the prices the
    caller serves -- already restated into the requested currency, which is the
    currency the reader is looking at.

    Returns None whenever the rate would not mean anything: fewer than two
    closes, a non-positive first close, or a span shorter than a year.
    """
    priced = [quote for quote in quotes if quote.get('close') is not None]
    if len(priced) < MIN_CAGR_QUOTES:
        return None

    first, last = priced[0], priced[-1]
    start, end = _quote_date(first['date']), _quote_date(last['date'])
    days = (end - start).days
    if days < MIN_CAGR_DAYS:
        return None

    first_close, last_close = float(first['close']), float(last['close'])
    if first_close <= 0 or last_close <= 0:
        return None

    years = days / DAYS_IN_YEAR
    return HistoricalCagr(
        value=(last_close / first_close) ** (1 / years) - 1,
        start_date=start,
        end_date=end,
    )


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
