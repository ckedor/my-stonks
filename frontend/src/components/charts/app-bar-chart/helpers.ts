import { DateRangeKey, getDateFromRange } from "@/lib/utils/date"
import dayjs from "dayjs"
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"
import { RangeOption } from "../shared/DateRangeMenu"
import { TimeSeriesPoint } from "./AppBarChart"

// Registered here because `filterByRange` below is what calls it. dayjs plugins
// are global, so this module used to work only when some other chart on the
// same page had already extended it -- correctness by import order, which held
// right up until a bar chart was rendered on its own.
dayjs.extend(isSameOrAfter)

export type GroupBy = 'day' | 'week' | 'month' | 'year'
export type LabelSide = 'left' | 'right'
export type ColorMode = 'profit-loss' | 'single'
export type ValueType = 'percent' | 'currency' | 'number'

export function filterByRange(series: TimeSeriesPoint[], range: DateRangeKey) {
  if (!series.length) return []
  const from = getDateFromRange(range)
  return series.filter((p) => dayjs(p.date).isSameOrAfter(from))
}

export function groupTimeSeries(
  series: TimeSeriesPoint[],
  groupBy: GroupBy
): TimeSeriesPoint[] {
  if (!series.length) return []

  const buckets: Record<string, TimeSeriesPoint> = {}

  for (const p of series) {
    const d = dayjs(p.date)

    const key =
      groupBy === 'day'
        ? d.format('YYYY-MM-DD')
        : groupBy === 'week'
        ? d.startOf('week').format('YYYY-MM-DD')
        : groupBy === 'month'
        ? d.format('YYYY-MM-01')
        : d.format('YYYY-01-01')

    if (!buckets[key]) {
      buckets[key] = { date: key, value: p.value }
    } else {
      buckets[key].value += p.value
    }
  }

  return Object.values(buckets).sort((a, b) =>
    dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
  )
}

export function formatXAxisTick(dateISO: string, groupBy: GroupBy) {
  const d = dayjs(dateISO)
  if (groupBy === 'year') return d.format('YYYY')
  if (groupBy === 'month') return d.format('MM/YY')
  return d.format('DD/MM')
}

export function computeDomain(values: number[]) {
  const min = values.length ? Math.min(...values, 0) : 0
  const max = values.length ? Math.max(...values, 0) : 0
  const padding = (max - min) * 0.2 || 5
  return [min - padding, max + padding] as [number, number]
}

export function computeTotalYearsFromOldest(oldestDateISO: string | null) {
  if (!oldestDateISO) return 0
  const oldest = dayjs(oldestDateISO)
  const totalMonths = dayjs().diff(oldest, 'month')
  return Math.floor(totalMonths / 12)
}

export function defaultRangeOptionsFromOldest(oldestDateISO: string | null): RangeOption[] {
  const currentYear = dayjs().year()
  const totalYears = computeTotalYearsFromOldest(oldestDateISO)

  const out: RangeOption[] = [
    { label: 'Max', value: 'max' },
    { label: `${currentYear}`, value: 'ytd' },
  ]

  for (let y = 1; y <= 10; y++) {
    if (y <= totalYears) out.push({ label: `${y}Y`, value: `${y}y` as DateRangeKey })
  }

  return out
}


export function toDisplayValue(value: number, valueType: ValueType) {
  if (valueType === 'percent') return value * 100
  return value
}