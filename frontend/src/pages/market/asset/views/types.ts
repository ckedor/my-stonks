import type { CandleDataPoint } from '@/components/charts/CandleChart'

/** What every per-type market view receives.
 *
 *  The page resolves the asset and its quotes once and hands the same props to
 *  whichever view the asset type selects, so a view never refetches what the
 *  page already has. Anything a single type needs on top of this — a fund's
 *  indicators, a stock's fundamentals — the view fetches for itself.
 */
export interface AssetMarketViewProps {
  assetId: number
  ticker: string
  candleData: CandleDataPoint[]
  /** Formats prices in the currency the reader chose. */
  priceFormatter: (value: number) => string
}
