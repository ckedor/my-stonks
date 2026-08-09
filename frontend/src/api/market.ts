import type { CandleDataPoint } from '@/components/charts/CandleChart'
import {
  ASSET_ROUTES,
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

export interface AssetQuoteHistory extends QuotesResponse {
  /** Where the quotes came from: 'database' or 'provider'. */
  source: 'database' | 'provider'
}

/** History for one asset, served from storage when we have it. */
export const fetchAssetQuoteHistory = (
  assetId: number,
  startDate?: string,
): Promise<AssetQuoteHistory> =>
  api
    .get<AssetQuoteHistory>(QUOTE_ROUTES.byAsset(assetId), { params: { start_date: startDate } })
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
    volume: q.volume ?? undefined,
  }))
}


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

/** Fire-and-forget: a lost visit count must never break the page. */
export const recordAssetVisit = (assetId: number): void => {
  void api.post(ASSET_ROUTES.visit(assetId)).catch(() => undefined)
}
