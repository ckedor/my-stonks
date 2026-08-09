import dayjs from 'dayjs'

export type CandleTimeframe = 'day' | 'week' | 'month'

export type CandleChartType = 'candlestick' | 'line'

export interface CandleDataPoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/** Window the moving average covers, in trading days. */
export const MOVING_AVERAGE_DAYS = 200

/** Candles that span {@link MOVING_AVERAGE_DAYS} in each timeframe, counting
 *  five trading days per week and roughly twenty per month. */
export const MOVING_AVERAGE_PERIODS: Record<CandleTimeframe, number> = {
  day: MOVING_AVERAGE_DAYS,
  week: Math.round(MOVING_AVERAGE_DAYS / 5),
  month: Math.round(MOVING_AVERAGE_DAYS / 20),
}

/** Below a full year, annualising extrapolates noise instead of measuring it,
 *  so the chart reports only the period return. */
export const MIN_DAYS_FOR_CAGR = 365

export function aggregateCandles(
  data: CandleDataPoint[],
  timeframe: CandleTimeframe,
): CandleDataPoint[] {
  if (timeframe === 'day') return data
  if (!data.length) return []

  const buckets: Record<string, CandleDataPoint[]> = {}

  for (const d of data) {
    const dt = dayjs(d.time)
    const key =
      timeframe === 'week' ? dt.startOf('week').format('YYYY-MM-DD') : dt.format('YYYY-MM-01')

    if (!buckets[key]) buckets[key] = []
    buckets[key].push(d)
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, candles]) => ({
      time: key,
      open: candles[0].open,
      high: Math.max(...candles.map((c) => c.high)),
      low: Math.min(...candles.map((c) => c.low)),
      close: candles[candles.length - 1].close,
      volume: candles.some((c) => c.volume != null)
        ? candles.reduce((sum, c) => sum + (c.volume ?? 0), 0)
        : undefined,
    }))
}

/** Keep points from `fromISO` onwards. ISO dates compare correctly as strings. */
export function filterFrom<T extends { time: string }>(points: T[], fromISO: string | null): T[] {
  if (!fromISO) return points
  return points.filter((point) => point.time >= fromISO)
}

export interface LinePoint {
  time: string
  value: number
}

/** Simple moving average of the close, starting once a full window exists. */
export function movingAverage(data: CandleDataPoint[], period: number): LinePoint[] {
  if (period < 2 || data.length < period) return []

  const points: LinePoint[] = []
  let sum = 0

  for (let i = 0; i < data.length; i += 1) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    if (i >= period - 1) {
      points.push({ time: data[i].time, value: sum / period })
    }
  }
  return points
}

export interface PeriodPerformance {
  /** Return over the whole visible window, as a ratio (0.12 = +12%). */
  totalReturn: number
  /** Annualised, or null when the window is too short to annualise. */
  cagr: number | null
  days: number
}

export function periodPerformance(data: CandleDataPoint[]): PeriodPerformance | null {
  if (data.length < 2) return null

  const first = data[0]
  const last = data[data.length - 1]
  if (!first.close) return null

  const totalReturn = last.close / first.close - 1
  const days = dayjs(last.time).diff(dayjs(first.time), 'day')
  if (days <= 0) return null

  const years = days / 365
  const cagr =
    days >= MIN_DAYS_FOR_CAGR ? (last.close / first.close) ** (1 / years) - 1 : null

  return { totalReturn, cagr, days }
}
