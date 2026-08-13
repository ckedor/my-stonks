import type { CandleDataPoint } from '@/components/charts/CandleChart'
import {
  ASSET_ROUTES,
  FII_ROUTES,
  INDEX_ROUTES,
  MARKET_DATA_SERIES_ROUTES,
  QUOTE_ROUTES,
  USD_BRL_ROUTES,
} from '@/constants/routes'
import api from '@/lib/api'
import type { ReturnsEntry } from '@/types'

export type BenchmarksPayload = Record<string, ReturnsEntry[]>

export const fetchBenchmarks = (): Promise<BenchmarksPayload> =>
  api.get<BenchmarksPayload>(INDEX_ROUTES.timeSeries).then((r) => r.data)

// ---------------------------------------------------------------------------
// Market data inspection (admin)
// ---------------------------------------------------------------------------

export interface UsdBrlHistoryPoint {
  date: string
  /** BRL value of one USD. */
  usd_brl: string
  /** USD value of one BRL, precomputed at ingestion. */
  brl_usd: string
  source: string
}

export const fetchUsdBrlHistory = (startDate?: string): Promise<UsdBrlHistoryPoint[]> =>
  api
    .get<UsdBrlHistoryPoint[]>(USD_BRL_ROUTES.history, {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

export interface MarketDataSeriesOption {
  id: number
  short_name: string
  name: string
  symbol: string
}

export const fetchMarketDataSeriesOptions = (): Promise<MarketDataSeriesOption[]> =>
  api.get<MarketDataSeriesOption[]>(MARKET_DATA_SERIES_ROUTES.options).then((r) => r.data)

export interface MarketDataSeriesHistoryPoint {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  source: string | null
}

export const fetchMarketDataSeriesHistory = (
  seriesId: number,
  startDate?: string,
): Promise<MarketDataSeriesHistoryPoint[]> =>
  api
    .get<MarketDataSeriesHistoryPoint[]>(MARKET_DATA_SERIES_ROUTES.history(seriesId), {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

export interface Currency {
  id: number
  code: string
  name: string
}

export const fetchCurrencies = (): Promise<Currency[]> =>
  api.get<Currency[]>(INDEX_ROUTES.currency).then((r) => r.data)

export interface PersistedQuote {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  adjusted_close: number | null
  volume: number | null
  currency_id: number | null
  source: string | null
}

export interface PersistedQuotesEntry {
  asset_id: number
  ticker: string
  asset_type_id: number
  quotes: PersistedQuote[]
}

export const fetchPersistedQuotes = (
  assetId: number,
  startDate?: string,
): Promise<PersistedQuotesEntry[]> =>
  api
    .get<PersistedQuotesEntry[]>(QUOTE_ROUTES.persisted, {
      params: { asset_ids: [assetId], start_date: startDate },
    })
    .then((r) => r.data)

export interface QuotesResponse {
  ticker: string
  asset_type: string
  currency: string | null
  /** Provider-hosted brand image, absent for tickers without one. */
  logo_url: string | null
  quotes: {
    date: string
    open: number | null
    high: number | null
    low: number | null
    close: number
    adjusted_close: number | null
    volume: number | null
  }[]
}

/** Annualized growth over the whole served history.
 *
 * The window travels with the rate: the same percentage means very different
 * things over three years and over thirty. */
export interface HistoricalCagr {
  value: number
  start_date: string
  end_date: string
}

export interface AssetQuoteHistory extends QuotesResponse {
  /** Where the quotes came from: 'database' or 'provider'. */
  source: 'database' | 'provider'
  /** Absent when the history is too short to annualize honestly. */
  cagr: HistoricalCagr | null
}

/** History for one asset, served from storage when we have it.
 *
 * Prices come back in `currency`; the backend converts through the USD/BRL
 * history when the asset is not quoted in it, and reports which currency the
 * quotes ended up in. */
export const fetchAssetQuoteHistory = (
  assetId: number,
  startDate?: string,
  currency: string = 'BRL',
): Promise<AssetQuoteHistory> =>
  api
    .get<AssetQuoteHistory>(QUOTE_ROUTES.byAsset(assetId), {
      params: { start_date: startDate, currency },
    })
    .then((r) => r.data)

export const fetchOnDemandAssetQuotes = (
  ticker: string,
  assetTypeId: number,
  startDate?: string,
): Promise<QuotesResponse> =>
  api.get<QuotesResponse>(QUOTE_ROUTES.onDemand, {
    params: { ticker, asset_type_id: assetTypeId, start_date: startDate },
  }).then((r) => r.data)

export function quotesToCandleData(quotes: QuotesResponse['quotes']): CandleDataPoint[] {
  return quotes.map((q) => ({
    time: q.date.slice(0, 10),
    open: q.open ?? q.close,
    high: q.high ?? q.close,
    low: q.low ?? q.close,
    close: q.close,
    adjustedClose: q.adjusted_close ?? undefined,
    volume: q.volume ?? undefined,
  }))
}


// ---------------------------------------------------------------------------
// Real-estate fund profile
// ---------------------------------------------------------------------------

/** One payment per share made by a fund. Always BRL: these funds pay in reais
 *  and the backend does not restate them.
 *
 *  `event_type` is the fund's own label — an ordinary distribution
 *  (`RENDIMENTO`) or an amortization of capital. A reader that means income
 *  filters on it rather than summing the two. */
export interface FIIDividend {
  payment_date: string
  ex_date: string | null
  value_per_share: number
  event_type: string | null
}

/** What the fund reports about itself, as of its last published report.
 *
 *  Every field is optional: a provider that has never covered a fund, or that
 *  drops one indicator, must cost the card that one value and nothing else. An
 *  absent indicator is null, never zero — an unknown P/VP and a P/VP of zero
 *  are different statements.
 *
 *  The yields and the monthly return are ratios — 0.12381 is 12.381% — so it
 *  is the presentation that scales them. `price_to_nav` is the published P/VP,
 *  a multiple around 1. Monetary fields are in BRL. */
export interface FIIIndicators {
  as_of_date: string | null
  segment_type: string | null
  segment: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  dividend_yield_12m: number | null
  dividend_yield_1m: number | null
  monthly_return: number | null
  equity: number | null
  total_assets: number | null
  shares_outstanding: number | null
  shareholders: number | null
}

export interface FIIProfile {
  ticker: string
  indicators: FIIIndicators | null
  dividends: FIIDividend[]
}

export const fetchFIIProfile = (assetId: number): Promise<FIIProfile> =>
  api.get<FIIProfile>(FII_ROUTES.profile(assetId)).then((r) => r.data)


// ---------------------------------------------------------------------------
// Favourites, ranked by how often the user opens an asset
// ---------------------------------------------------------------------------

export interface FavoriteAsset {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type: { id: number; short_name: string; name: string }
  visit_count: number
  last_visited_at: string | null
}

export const fetchFavoriteAssets = (limit = 8): Promise<FavoriteAsset[]> =>
  api.get<FavoriteAsset[]>(ASSET_ROUTES.favorites, { params: { limit } }).then((r) => r.data)

/** Counts one visit. Always resolves: a lost visit count must never break the
 *  page. Awaited only to reorder the ranking after the backend has taken it. */
export const recordAssetVisit = (assetId: number): Promise<void> =>
  api
    .post(ASSET_ROUTES.visit(assetId))
    .then(() => undefined)
    .catch(() => undefined)
