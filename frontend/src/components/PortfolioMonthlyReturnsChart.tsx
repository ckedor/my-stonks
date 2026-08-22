// src/components/PortfolioMonthlyReturnsChart.tsx
import { AppChartArea, AppInlineToggle, AppStack, SectionTitle, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface SeriesPoint {
  date: string
  value: number
}

interface Props {
  height?: number
  defaultRange?: string
  data: SeriesPoint[]
}

interface MonthlyPoint {
  month: string
  monthlyChange: number
}

export default function PortfolioMonthlyReturnsChart({
  height = 260,
  defaultRange = '1y',
  data,
}: Props) {
  const theme = useAppTheme()

  const successColor = theme.palette.success.main
  const warningColor = theme.palette.error.main
  const gridColor = theme.palette.chart?.grid ?? theme.palette.divider
  const labelColor = theme.palette.chart?.label ?? theme.palette.text.secondary

  const [range, setRange] = useState<string>(defaultRange)

  const baseSeries: SeriesPoint[] = useMemo(() => {
    return data || []
  }, [data])

  // datas completas da curva selecionada (para calcular ranges possíveis)
  const allDates = useMemo(
    () => baseSeries.map((p) => p.date).sort(),
    [baseSeries]
  )

  const filteredSeries: SeriesPoint[] = useMemo(() => {
    if (!baseSeries.length) return []
    const today = dayjs()
    let from: dayjs.Dayjs

    switch (range) {
      case 'ytd':
        from = today.startOf('year')
        break
      case '1y':
        from = today.subtract(1, 'year')
        break
      case '2y':
        from = today.subtract(2, 'year')
        break
      case '3y':
        from = today.subtract(3, 'year')
        break
      case '4y':
        from = today.subtract(4, 'year')
        break
      case '5y':
        from = today.subtract(5, 'year')
        break
      case 'max':
      default:
        from = dayjs('1900-01-01')
    }

    return baseSeries.filter((p) => dayjs(p.date).isSameOrAfter(from))
  }, [baseSeries, range])

  const monthlyData: MonthlyPoint[] = useMemo(() => {
    if (filteredSeries.length === 0) return []

    const sorted = [...filteredSeries].sort(
      (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    )

    const byMonth: Record<string, { date: string; value: number }> = {}

    for (const point of sorted) {
      const monthKey = dayjs(point.date).format('YYYY-MM')
      if (!byMonth[monthKey] || dayjs(point.date).isBefore(byMonth[monthKey].date)) {
        byMonth[monthKey] = { date: point.date, value: point.value }
      }
    }

    const sortedMonths = Object.keys(byMonth).sort()
    const result: MonthlyPoint[] = []

    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = byMonth[sortedMonths[i - 1]]
      const curr = byMonth[sortedMonths[i]]
      const change = (curr.value - prev.value) * 100

      // o retorno é do mês do prev
      result.push({
        month: dayjs(prev.date).format('MM/YY'),
        monthlyChange: change,
      })
    }

    return result
  }, [filteredSeries])

  const values = monthlyData.map((d) => d.monthlyChange)
  const min = values.length ? Math.min(...values, 0) : 0
  const max = values.length ? Math.max(...values, 0) : 0
  const padding = (max - min) * 0.2 || 5
  const domain: [number, number] = [min - padding, max + padding]

  // ranges possíveis (mesma lógica do gráfico principal)
  const currentYear = dayjs().year()
  const totalMonths = allDates.length
    ? dayjs(allDates.at(-1) as string).diff(dayjs(allDates[0] as string), 'month')
    : 0
  const totalYears = Math.floor(totalMonths / 12)

  const ranges = useMemo(() => {
    const base = [
      { label: 'Max', value: 'max' },
      { label: `${currentYear}`, value: 'ytd' },
    ]
    for (let y = 1; y <= 5; y++) {
      if (y <= totalYears) base.push({ label: `${y}Y`, value: `${y}y` })
    }
    return base
  }, [totalYears, currentYear])

  if (!monthlyData.length) {
    return (
      <AppChartArea
        height={height}
        emptyMessage="Sem dados de rentabilidade para exibir o desempenho mensal."
      />
    )
  }

  return (
    <AppChartArea
      height={height}
      toolbar={
        <AppStack direction="row" justify="between" align="center" gap="md">
          <SectionTitle>Desempenho Mensal</SectionTitle>
          <AppInlineToggle options={ranges} value={range} onChange={setRange} />
        </AppStack>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="month"
              stroke={labelColor}
              tickFormatter={(v) => {
                const value = String(v) // ex: "03/25"
                const [mm] = value.split('/') // "03"
                return mm === '01' ? value : mm
              }}
            />
            <YAxis
              orientation="right"
              domain={domain}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              stroke={labelColor}
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value as number).toFixed(2)}%`,
                'Retorno mensal',
              ]}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <Bar dataKey="monthlyChange" name="Retorno mensal">
              {monthlyData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.monthlyChange >= 0 ? successColor : warningColor}
                />
              ))}
            </Bar>
          </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
