import type { FIICompositionPoint, FIIMonthlyReport } from '@/api/market'
import { AppChartArea, useAppTheme } from '@/components/ui'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompactBRL, formatDate, formatMonth } from './format'
import { assetClassLabel } from './labels'
import { compositionHistoryWithCurrentReport } from './readings'

const CHART_HEIGHT = 260

interface Row {
  date: string
  [assetClass: string]: string | number
}

/** How the fund's declared holdings moved, quarter by quarter.
 *
 *  Stacked, because the question is what the fund is made of and not how each
 *  piece did on its own. Only what the filing prices can be stacked: it counts
 *  the buildings and declares no value for them, so a brick fund's largest
 *  half is missing from the bars by construction. The card says so beside the
 *  chart rather than leaving the reader to infer it from a suspiciously small
 *  total.
 */
export default function FIICompositionHistoryChart({
  history,
  report,
}: {
  history: FIICompositionPoint[]
  report: FIIMonthlyReport | null
}) {
  const theme = useAppTheme()

  const priced = useMemo(
    () =>
      compositionHistoryWithCurrentReport({ history, report }).filter(
        (quarter) =>
          quarter.reference_date &&
          quarter.allocations.some((allocation) => allocation.value != null)
      ),
    [history, report]
  )

  /* One bar segment per class that is priced somewhere in the series. A class
     the fund only held in one quarter still gets its segment, empty in the
     others, instead of shifting the colours of everything after it. */
  const classes = useMemo(() => {
    const seen = new Map<string, number>()
    for (const quarter of priced) {
      for (const allocation of quarter.allocations) {
        if (allocation.value != null && !seen.has(allocation.asset_class)) {
          seen.set(allocation.asset_class, allocation.value)
        }
      }
    }
    return [...seen.keys()]
  }, [priced])

  const rows = useMemo<Row[]>(
    () =>
      priced.map((quarter) => {
        const row: Row = { date: quarter.reference_date as string }
        for (const allocation of quarter.allocations) {
          if (allocation.value != null) row[allocation.asset_class] = allocation.value
        }
        return row
      }),
    [priced]
  )

  return (
    <AppChartArea
      height={CHART_HEIGHT}
      emptyMessage={
        rows.length ? undefined : 'O provedor não retornou histórico de carteira para este fundo.'
      }
    >
      {rows.length > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.chart.grid} />
            <XAxis dataKey="date" tickFormatter={formatMonth} stroke={theme.palette.chart.label} />
            <YAxis
              orientation="right"
              tickFormatter={(value: number) => formatCompactBRL(value)}
              stroke={theme.palette.chart.label}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => formatCompactBRL(value)}
              labelFormatter={(value: string) => formatDate(value)}
            />
            <Legend />
            {classes.map((assetClass, index) => (
              <Bar
                key={assetClass}
                dataKey={assetClass}
                name={assetClassLabel(assetClass)}
                stackId="composition"
                fill={theme.palette.chart.colors[index % theme.palette.chart.colors.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </AppChartArea>
  )
}
