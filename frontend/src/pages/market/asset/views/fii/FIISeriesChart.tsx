import { AppChartArea, AppSelect, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMonth } from './format'

const CHART_HEIGHT = 260

export interface FIISeriesMetric<Point> {
  /** Identity of the metric in the picker. */
  key: string
  label: string
  read: (point: Point) => number | null | undefined
  format: (value: number) => string
}

interface Props<Point> {
  points: Point[]
  /** When the filing each point came from refers to. */
  dateOf: (point: Point) => string | null
  metrics: FIISeriesMetric<Point>[]
  /** What the picker chooses, for whoever cannot see the chart. */
  label: string
  emptyMessage: string
}

/** One published series at a time, chosen from a list.
 *
 *  A fund files a dozen numbers on every report and they share nothing but the
 *  date: equity is in billions, P/VP is around one, and a chart holding both
 *  flattens the second onto the axis. So the reader picks which one is drawn
 *  instead of the card drawing twelve, and each metric carries its own way of
 *  being written — a ratio is not a multiple is not a count of people.
 *
 *  A filing that omits the chosen number is left out of the line rather than
 *  read as zero, which would draw a fall that never happened.
 */
export default function FIISeriesChart<Point>({
  points,
  dateOf,
  metrics,
  label,
  emptyMessage,
}: Props<Point>) {
  const theme = useAppTheme()
  const [selected, setSelected] = useState(metrics[0].key)

  /* Only what the fund actually reported can be picked. The picker lives in
     the chart's toolbar, and an area with nothing to draw replaces the whole
     toolbar with its message — so offering an empty metric would hide the
     control that chose it, with no way back. */
  const available = useMemo(
    () => metrics.filter((metric) => points.some((point) => metric.read(point) != null)),
    [metrics, points]
  )

  const metric = available.find((item) => item.key === selected) ?? available[0]

  const data = useMemo(() => {
    if (!metric) return []

    return points
      .map((point) => ({ date: dateOf(point), value: metric.read(point) }))
      .filter((point): point is { date: string; value: number } =>
        Boolean(point.date && point.value != null)
      )
  }, [points, dateOf, metric])

  const picker = (
    <AppSelect
      options={available.map((item) => ({ value: item.key, label: item.label }))}
      value={metric?.key ?? ''}
      onChange={setSelected}
      label={label}
      size="auto"
      variant="inline"
    />
  )

  return (
    <AppChartArea
      height={CHART_HEIGHT}
      toolbar={picker}
      emptyMessage={data.length ? undefined : emptyMessage}
    >
      {metric && data.length > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.chart.grid} />
            <XAxis
              dataKey="date"
              tickFormatter={formatMonth}
              stroke={theme.palette.chart.label}
              minTickGap={24}
            />
            <YAxis
              orientation="right"
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => metric.format(value)}
              stroke={theme.palette.chart.label}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [metric.format(value), metric.label]}
              labelFormatter={(value: string) => dayjs(value).format('DD/MM/YYYY')}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={theme.palette.chart.colors[0]}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </AppChartArea>
  )
}
