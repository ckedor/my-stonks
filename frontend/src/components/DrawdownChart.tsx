import { AppMetric, AppStack, SectionTitle, useAppTheme } from '@/components/ui'
import { DrawdownEntry, DrawdownStats } from '@/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import {
    Area,
    CartesianGrid,
    ComposedChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface Props {
  series: DrawdownEntry[]
  stats: DrawdownStats
  size?: number
}

export default function DrawdownChart({ series, stats, size = 300 }: Props) {
  const theme = useAppTheme()
  const gridColor = theme.palette.chart.grid
  const labelColor = theme.palette.chart.label

  const chartData = useMemo(
    () => series.map((d) => ({ date: d.date, drawdown: d.drawdown * 100 })),
    [series],
  )

  const xTicks = useMemo(() => {
    const ticks: string[] = []
    chartData.forEach((d) => {
      const day = dayjs(d.date)
      if (day.date() === 1) ticks.push(d.date)
    })
    return ticks.length ? ticks : chartData.map((d) => d.date)
  }, [chartData])

  if (!chartData.length) return null

  const minVal = Math.min(...chartData.map((d) => d.drawdown))
  const pad = Math.abs(minVal) * 0.1

  return (
    <AppStack gap="md">
      <SectionTitle>Drawdown</SectionTitle>

      <AppStack direction="row" gap="xl" wrap justify="center">
        <AppMetric
          align="center"
          label="Max Drawdown"
          value={`${(stats.max_drawdown * 100).toFixed(2)}%`}
          tone="danger"
        />
        <AppMetric
          align="center"
          label="Data do Pico"
          value={dayjs(stats.peak_date_before_max_dd).format('DD/MM/YY')}
        />
        <AppMetric
          align="center"
          label="Data do Max DD"
          value={dayjs(stats.max_drawdown_date).format('DD/MM/YY')}
        />
        {stats.recovery_date && (
          <AppMetric
            align="center"
            label="Recuperação"
            value={dayjs(stats.recovery_date).format('DD/MM/YY')}
          />
        )}
        {stats.recovery_days != null && (
          <AppMetric align="center" label="Dias p/ Recuperar" value={`${stats.recovery_days}d`} />
        )}
        {stats.max_drawdown_duration_days != null && (
          <AppMetric
            align="center"
            label="Duração Max DD"
            value={`${stats.max_drawdown_duration_days}d`}
          />
        )}
      </AppStack>

      <ResponsiveContainer width="100%" height={size}>
        <ComposedChart data={chartData} margin={{ left: 10 }}>
          <defs>
            <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.palette.error.main} stopOpacity={0.05} />
              <stop offset="100%" stopColor={theme.palette.error.main} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            interval={0}
            minTickGap={0}
            tickFormatter={(v) => {
              const d = dayjs(v)
              return d.month() === 0 ? d.format('MM/YY') : d.format('MM')
            }}
            stroke={labelColor}
          />
          <YAxis
            orientation="right"
            domain={[minVal - pad, 0]}
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            stroke={labelColor}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
            labelFormatter={(label) => dayjs(label).format('DD/MM/YYYY')}
          />
          <ReferenceLine y={0} stroke={labelColor} strokeWidth={1.5} />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke={theme.palette.error.main}
            strokeWidth={1.5}
            fill="url(#ddGradient)"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </AppStack>
  )
}
