import { useCurrency } from '@/hooks/useCurrency'
import { PatrimonyEntry } from '@/types'
import { Box, CircularProgress, useTheme } from '@mui/material'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import {
    Area,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface Props {
  patrimonyEvolution: PatrimonyEntry[]
  selected: string
  size?: number | string
  loading?: boolean
}

export default function OverviewPatrimonyChart({
  patrimonyEvolution,
  selected,
  size = 340,
  loading = false,
}: Props) {
  const key = selected === 'Carteira' ? 'portfolio' : selected
  const theme = useTheme()
  const { symbol, locale } = useCurrency()
  const lineColor = theme.palette.primary.main
  const labelColor = theme.palette.chart.label

  const chartData = useMemo(() => {
    return patrimonyEvolution
      .filter((entry) => Number.isFinite(entry[key] as number))
      .map((entry) => {
        const raw = dayjs(entry.date)
        return {
          ts: raw.valueOf(),
          dateLabel: raw.format('MM/YY'),
          value: entry[key] as number,
        }
      })
  }, [patrimonyEvolution, key])

  const { yTicks, yDomain } = useMemo(() => {
    if (!chartData.length) return { yTicks: [0], yDomain: [0, 0] as [number, number] }
    let maxVal = 0
    for (const d of chartData) {
      if (d.value > maxVal) maxVal = d.value
    }
    const dynamicMax = maxVal * 1.1
    const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000]
    const rawStep = dynamicMax / 5
    const step = niceSteps.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 100000) * 100000
    const max = Math.ceil(dynamicMax / step) * step
    const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
    return { yTicks: ticks, yDomain: [0, ticks[ticks.length - 1] || dynamicMax] as [number, number] }
  }, [chartData])

  const januaryTicks = useMemo(() => {
    if (!chartData.length) return []
    const minTs = chartData[0].ts
    const maxTs = chartData[chartData.length - 1].ts
    let cursor = dayjs(minTs).startOf('year').month(0).date(1)
    if (cursor.valueOf() < minTs) cursor = cursor.add(1, 'year')
    const ticks: number[] = []
    while (cursor.valueOf() <= maxTs) {
      ticks.push(cursor.valueOf())
      cursor = cursor.add(1, 'year')
    }
    return ticks
  }, [chartData])

  const gradientId = 'overviewPatrimonyGradient'

  if (loading) {
    return (
      <Box height={size} display="flex" justifyContent="center" alignItems="center">
        <CircularProgress size={48} thickness={4} />
      </Box>
    )
  }

  return (
    <Box sx={{ height: size, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 48, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.12} />
              <stop offset="60%" stopColor={lineColor} stopOpacity={0.04} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            ticks={januaryTicks}
            tickFormatter={(v) => dayjs(v).format('MM/YY')}
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            orientation="right"
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize: 12 }}
            tickFormatter={(v: number) =>
              v >= 1000000
                ? `${(v / 1000000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`
                : v >= 1000
                  ? `${(v / 1000).toLocaleString(locale, { maximumFractionDigits: 0 })}K`
                  : v.toLocaleString(locale)
            }
            ticks={yTicks}
            domain={yDomain}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            labelFormatter={(v) => dayjs(v as number).format('DD/MM/YY')}
            formatter={(value: number) => [
              `${symbol} ${value.toLocaleString(locale, { maximumFractionDigits: 0 })}`,
              'Patrimônio',
            ]}
            contentStyle={{
              borderRadius: 8,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              fontSize: 13,
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
            name="Patrimônio"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  )
}
