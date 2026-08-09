import type { DateRangeKey } from '@/lib/utils/date'
import type { CandleChartType, CandleTimeframe } from './helpers'

const STORAGE_PREFIX = 'my-stonks:chart:'

/** Window the user is looking at, in the chart's own time values. Daily series
 *  use `YYYY-MM-DD` strings, so this stays JSON-friendly. */
export interface PersistedView {
  from: string | number
  to: string | number
}

export interface PersistedChartState {
  range?: DateRangeKey
  timeframe?: CandleTimeframe
  chartType?: CandleChartType
  logScale?: boolean
  movingAverage?: boolean
  volume?: boolean
  view?: PersistedView | null
}

/** Reading never throws: a corrupt or unavailable store just means no
 *  preference, and the chart falls back to its defaults. */
export function readChartState(key: string | undefined): PersistedChartState {
  if (!key || typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as PersistedChartState) : {}
  } catch {
    return {}
  }
}

export function writeChartState(
  key: string | undefined,
  patch: Partial<PersistedChartState>,
): void {
  if (!key || typeof window === 'undefined') return
  try {
    const next = { ...readChartState(key), ...patch }
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(next))
  } catch {
    // A full or blocked store must not break the chart.
  }
}

export function isValidView(view: unknown): view is PersistedView {
  if (!view || typeof view !== 'object') return false
  const { from, to } = view as PersistedView
  const isTime = (v: unknown) => typeof v === 'string' || typeof v === 'number'
  return isTime(from) && isTime(to)
}
