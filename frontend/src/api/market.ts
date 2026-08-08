import type { CandleDataPoint } from '@/components/charts/CandleChart'
import { INDEX_ROUTES, QUOTE_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { ReturnsEntry } from '@/types'

export type BenchmarksPayload = Record<string, ReturnsEntry[]>

export const fetchBenchmarks = (): Promise<BenchmarksPayload> =>
  api.get<BenchmarksPayload>(INDEX_ROUTES.timeSeries).then((r) => r.data)

export interface QuotesResponse {
  ticker: string
  asset_type: string
  currency: string | null
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
