import type { CandleDataPoint } from '@/components/charts/CandleChart'
import { INDEX_ROUTES, QUOTE_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { ReturnsEntry } from '@/types'

export type BenchmarksPayload = Record<string, ReturnsEntry[]>

export const fetchBenchmarks = (): Promise<BenchmarksPayload> =>
  api.get<BenchmarksPayload>(INDEX_ROUTES.timeSeries).then((r) => r.data)

export interface QuoteResponse {
  ticker: string
  asset_type: string
  currency: string | null
  quotes: { date: string; open: number | null; high: number | null; low: number | null; close: number; volume: number | null }[]
}

export const fetchAssetQuotes = (ticker: string, assetType?: string): Promise<QuoteResponse> =>
  api.get<QuoteResponse>(QUOTE_ROUTES.get, { params: { ticker, asset_type: assetType } }).then((r) => r.data)

export function quotesToCandleData(quotes: QuoteResponse['quotes']): CandleDataPoint[] {
  return quotes.map((q) => ({
    time: q.date.slice(0, 10),
    open: q.open ?? q.close,
    high: q.high ?? q.close,
    low: q.low ?? q.close,
    close: q.close,
    volume: q.volume ?? undefined,
  }))
}
