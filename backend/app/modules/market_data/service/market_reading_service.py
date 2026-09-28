"""The market readings: the world tab's exchange rate, bitcoin, gold, CDI, MSCI
indexes and Ibovespa in dollars, and the reference ETFs."""

from dataclasses import dataclass, replace

import pandas as pd

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.constants import ASSET_TYPE, CURRENCY, SERIES
from app.modules.market_data.domain.market_reading import (
    LevelReading,
    RateReading,
    accumulated_level_from_daily_rates,
    annualized_rate_from_daily,
    level_reading,
    rate_reading,
    ratio,
    real_rate,
    restated,
    trailing_twelve_months,
    weekly_closes,
    weekly_last,
)
from app.modules.market_data.domain.reference_etfs import (
    REFERENCE_ETFS,
    EtfExposure,
    EtfListing,
)
from app.modules.market_data.domain.usd_brl import usd_brl_payload_to_df
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService

#: The indexes read, in the order they are shown.
WORLD_INDEXES = (
    ('msci_acwi', SERIES.MSCI_ACWI),
    ('msci_world', SERIES.MSCI_WORLD),
    ('msci_usa', SERIES.MSCI_USA),
    ('msci_acwi_ex_usa', SERIES.MSCI_ACWI_EX_USA),
    ('msci_em', SERIES.MSCI_EM),
)

#: One index against another: (key, numerator, denominator).
WORLD_COMPARISONS = (
    ('usa_vs_acwi_ex_usa', SERIES.MSCI_USA, SERIES.MSCI_ACWI_EX_USA),
    ('em_vs_world', SERIES.MSCI_EM, SERIES.MSCI_WORLD),
)

#: Brazil among the world's markets: the Ibovespa, restated in dollars so it
#: reads against the MSCI indexes. It is a total return index already, so the
#: comparison with their net return holds; the reading links to the index in
#: its own currency.
BRAZIL_INDEX = ('ibovespa_usd', SERIES.IBOVESPA)

BITCOIN_TICKER = 'BTC'

#: Gold in dollars per troy ounce, read like any other level.
GOLD = ('gold', SERIES.GOLD)

#: The first day of the real. The exchange-rate table goes back to 1984 in
#: cruzeiros and cruzados, never rescaled, so read from there the dollar's
#: all-time high is a 1994 cruzeiro and every drawdown is -100%.
REAL_CURRENCY_START = pd.Timestamp('1994-07-01')


@dataclass(frozen=True, kw_only=True)
class WorldMarketReadings:
    levels: list[LevelReading]
    comparisons: list[LevelReading]
    rates: list[RateReading]


#: The weeks of history an ETF reading carries: one year, enough for the
#: sparkline beside it. The whole path is a click away, on the asset's page.
ETF_HISTORY_WEEKS = 53


@dataclass(frozen=True, kw_only=True)
class ReferenceEtfReading:
    ticker: str
    name: str
    asset_id: int
    exposure: EtfExposure
    listing: EtfListing
    currency: str | None
    #: The last close against the one before it, in the fund's own currency.
    day_change: float | None
    reading: LevelReading


@dataclass(frozen=True)
class ReferenceEtfSelection:
    #: Already have quotes: an incremental run keeps them current.
    priced: list[int]
    #: Have none: need the whole history once.
    unpriced: list[int]


class MarketReadingService:
    def __init__(self, uow: UnitOfWork, usd_brl: UsdBrlReadService):
        self.uow = uow
        self.usd_brl = usd_brl

    async def get_world_readings(self) -> WorldMarketReadings:
        index_ids = [series_id for _, series_id in WORLD_INDEXES]
        async with self.uow as uow:
            histories = {
                series_id: await uow.market_data.get_series_history_entries(series_id)
                for series_id in [*index_ids, BRAZIL_INDEX[1], GOLD[1], SERIES.CDI, SERIES.IPCA]
            }
            bitcoin = await uow.assets.get_by_tickers(
                [BITCOIN_TICKER], asset_type_id=ASSET_TYPE.CRIPTO
            )
            bitcoin_quotes = await uow.quotes.get_quotes([bitcoin[0].id]) if bitcoin else []
        usd_brl = usd_brl_payload_to_df(await self.usd_brl.get_full_history())

        closes = {series_id: _closes(entries) for series_id, entries in histories.items()}
        weekly = {series_id: weekly_closes(closes[series_id]) for series_id in index_ids}

        rates_since_real = usd_brl.set_index('date')[['usd_brl', 'brl_usd']].astype(float)
        rates_since_real = rates_since_real[rates_since_real.index >= REAL_CURRENCY_START]

        levels: list[LevelReading] = []
        if not rates_since_real.empty:
            levels.append(level_reading('usd_brl', weekly_closes(rates_since_real['usd_brl'])))
        bitcoin_closes = pd.Series(
            {
                pd.Timestamp(quote.date): float(quote.close)
                for quote in bitcoin_quotes
                if quote.close is not None
            },
            dtype=float,
        )
        if not bitcoin_closes.empty:
            levels.append(
                level_reading('btc', weekly_closes(bitcoin_closes), asset_id=bitcoin[0].id)
            )
        gold_key, gold_id = GOLD
        gold = weekly_closes(closes[gold_id])
        if not gold.empty:
            levels.append(level_reading(gold_key, gold, series_id=gold_id))
        levels.extend(
            level_reading(key, weekly[series_id], series_id=series_id)
            for key, series_id in WORLD_INDEXES
            if not weekly[series_id].empty
        )
        brazil_key, brazil_id = BRAZIL_INDEX
        brazil = weekly_closes(restated(closes[brazil_id], rates_since_real['brl_usd']))
        if not brazil.empty:
            levels.append(level_reading(brazil_key, brazil, series_id=brazil_id))

        comparisons = [
            level_reading(key, series)
            for key, numerator, denominator in WORLD_COMPARISONS
            if not (series := ratio(weekly[numerator], weekly[denominator])).empty
        ]

        return WorldMarketReadings(
            levels=levels,
            comparisons=comparisons,
            rates=_interest_rates(closes[SERIES.CDI], closes[SERIES.IPCA]),
        )

    async def get_reference_etf_selection(self) -> ReferenceEtfSelection:
        """The registered assets behind the reference ETFs, for the quote
        ingestion to keep priced whether anyone holds them or not.

        Split by whether they have any quote yet: an incremental run asks an
        empty asset for a week only, and a fund added to the list needs its
        whole history once — which a held asset gets when it is bought, and a
        reference ETF never is.
        """
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(
                [etf.ticker for etf in REFERENCE_ETFS], asset_type_id=ASSET_TYPE.ETF
            )
            asset_ids = [asset.id for asset in assets]
            latest = await uow.quotes.get_latest_quote_dates(asset_ids)
        return ReferenceEtfSelection(
            priced=sorted(asset_id for asset_id in asset_ids if latest.get(asset_id)),
            unpriced=sorted(asset_id for asset_id in asset_ids if not latest.get(asset_id)),
        )

    async def get_reference_etf_readings(self) -> list[ReferenceEtfReading]:
        """Each reference ETF read like a level, on the adjusted close: the
        dividends are in it, as they are in the MSCI net indexes.

        A fund not registered, or with no quote yet — a new entry in the list
        before the ingestion has run — is left out rather than shown empty.
        """
        async with self.uow as uow:
            assets = await uow.assets.get_by_tickers(
                [etf.ticker for etf in REFERENCE_ETFS], asset_type_id=ASSET_TYPE.ETF
            )
            prices = await uow.quotes.get_adjusted_prices([asset.id for asset in assets])

        by_ticker = {asset.ticker: asset for asset in assets}
        # One frame for every row, split by asset: building the index a row at
        # a time was most of the read.
        frame = pd.DataFrame(prices, columns=['asset_id', 'date', 'price', 'currency_id'])
        frame['date'] = pd.to_datetime(frame['date'])
        closes = {
            asset_id: group.set_index('date')['price'].astype(float)
            for asset_id, group in frame.groupby('asset_id')
        }
        currencies = {
            asset_id: _currency_code(group['currency_id'].iloc[-1])
            for asset_id, group in frame.groupby('asset_id')
        }

        readings: list[ReferenceEtfReading] = []
        for etf in REFERENCE_ETFS:
            asset = by_ticker.get(etf.ticker)
            if asset is None or asset.id not in closes:
                continue
            daily = closes[asset.id].sort_index()
            reading = level_reading(etf.ticker, weekly_closes(daily), asset_id=asset.id)
            readings.append(
                ReferenceEtfReading(
                    ticker=etf.ticker,
                    name=asset.name,
                    asset_id=asset.id,
                    exposure=etf.exposure,
                    listing=etf.listing,
                    currency=currencies.get(asset.id),
                    day_change=(
                        float(daily.iloc[-1] / daily.iloc[-2] - 1) if len(daily) > 1 else None
                    ),
                    reading=replace(reading, history=reading.history[-ETF_HISTORY_WEEKS:]),
                )
            )
        return readings


def _closes(entries) -> pd.Series:
    return pd.Series(
        {
            pd.Timestamp(entry.date): float(entry.close)
            for entry in entries
            if entry.close is not None
        },
        dtype=float,
    ).sort_index()


def _interest_rates(cdi_daily: pd.Series, ipca_monthly: pd.Series) -> list[RateReading]:
    """The CDI as an annual rate, and what it pays over IPCA.

    The real rate compares the CDI accumulated over twelve months with the IPCA
    of the same twelve months -- what was actually earned, not the rate on the
    day.
    """
    if cdi_daily.empty:
        return []
    # The table stores 0% on days without a session: right for compounding --
    # the day earned nothing -- but not a rate. A holiday Friday would close
    # its week at 0% a year.
    session_rates = cdi_daily[cdi_daily > 0]
    rates = [
        rate_reading(
            'cdi',
            weekly_last(annualized_rate_from_daily(session_rates)),
            series_id=SERIES.CDI,
        )
    ]
    cdi_12m = trailing_twelve_months(accumulated_level_from_daily_rates(cdi_daily))
    ipca_12m = trailing_twelve_months(accumulated_level_from_daily_rates(ipca_monthly))
    real = real_rate(cdi_12m, ipca_12m)
    if not real.empty:
        rates.append(rate_reading('real_interest', weekly_last(real)))
    return rates


def _currency_code(currency_id: int | None) -> str | None:
    try:
        return CURRENCY(currency_id).name
    except ValueError:
        return None
