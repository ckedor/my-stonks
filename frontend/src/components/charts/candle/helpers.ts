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

/** The candle at a chart logical index, clamped to the series.
 *
 *  The index is fractional and can sit outside the data when the click lands in
 *  the whitespace beside the series, so it is rounded to the nearest candle and
 *  held within bounds. Returns `null` only when there is nothing to snap to. */
export function candleAt(
  data: CandleDataPoint[],
  logical: number | null | undefined,
): CandleDataPoint | null {
  if (!data.length || logical == null || !Number.isFinite(logical)) return null
  const index = Math.min(data.length - 1, Math.max(0, Math.round(logical)))
  return data[index]
}

export interface MeasureAnchor {
  /** Chart time value, `YYYY-MM-DD` for the daily series. */
  time: string
  price: number
}

export interface Measurement {
  /** Change from the first anchor to the second, as a ratio (0.12 = +12%). */
  variation: number
  /** The same change in price units. */
  absolute: number
  /** Calendar days spanned, always positive. */
  days: number
}

/** The change between two points a user picked, in whichever order they picked
 *  them: the earlier anchor is always the baseline. Returns `null` when the
 *  baseline is zero or negative, where a percentage says nothing. */
export function measureBetween(a: MeasureAnchor, b: MeasureAnchor): Measurement | null {
  const [from, to] = a.time <= b.time ? [a, b] : [b, a]
  if (from.price <= 0) return null

  return {
    variation: to.price / from.price - 1,
    absolute: to.price - from.price,
    days: Math.abs(dayjs(to.time).diff(dayjs(from.time), 'day')),
  }
}

/** How long a span is, in the coarsest unit that still reads precisely.
 *
 *  A return means nothing without the window it covers: `+93418%` is absurd
 *  over a year and unremarkable over thirty. */
export function formatSpan(days: number): string {
  if (days < 1) return 'hoje'
  if (days < DAYS_IN_MONTH) return `${days} ${days === 1 ? 'dia' : 'dias'}`
  if (days < DAYS_IN_YEAR) {
    const months = Math.round(days / DAYS_IN_MONTH)
    return `${months} ${months === 1 ? 'mês' : 'meses'}`
  }
  const years = days / DAYS_IN_YEAR
  // One decimal below ten years, whole years above: "1,5 anos" is useful,
  // "23,4 anos" is just noise. A whole number of years drops the decimal
  // altogether -- the ranges on offer are whole months and whole years, so
  // "2,0 anos" only ever means "2 anos".
  const rounded = years < 10 ? Math.round(years * 10) / 10 : Math.round(years)
  const value = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',')
  return `${value} ${rounded === 1 ? 'ano' : 'anos'}`
}

const DAYS_IN_MONTH = 30
const DAYS_IN_YEAR = 365

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
