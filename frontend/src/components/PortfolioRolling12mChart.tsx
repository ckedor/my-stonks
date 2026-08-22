// src/components/PortfolioRolling12mChart.tsx
import { AppChartArea, SectionTitle, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  data: SeriesPoint[]
}

interface RollingPoint {
  date: string
  rolling12m: number | null
}

export default function PortfolioRolling12mChart({
  height = 260,
  data,
}: Props) {
  const theme = useAppTheme()

  const lineColor = theme.palette.primary.main
  const gridColor = theme.palette.chart?.grid ?? theme.palette.divider
  const labelColor = theme.palette.chart?.label ?? theme.palette.text.secondary
  const averageLineColor = theme.palette.text.secondary

  // série base diária da curva selecionada (sempre completa)
  const baseSeries: SeriesPoint[] = useMemo(() => {
    return data || []
  }, [data])

  // Rolling 12m calculado em cima da série COMPLETA
  const rollingAll: RollingPoint[] = useMemo(() => {
    if (!baseSeries.length) return []

    const sorted = [...baseSeries].sort(
      (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    )

    const dates = sorted.map((p) => dayjs(p.date))
    const firstDate = dates[0]
    const result: RollingPoint[] = []

    let windowStartIdx = 0

    for (let i = 0; i < sorted.length; i++) {
      const currentDate = dates[i]
      const windowStartDate = currentDate.subtract(12, 'month')

      // avança o início da janela até ser >= data alvo - 12 meses
      while (windowStartIdx < i && dates[windowStartIdx].isBefore(windowStartDate)) {
        windowStartIdx++
      }

      // se ainda não temos 12 meses de histórico desde o primeiro ponto, não calcula
      const hasFullYear = currentDate.diff(firstDate, 'month') >= 12

      let rolling: number | null = null
      if (hasFullYear) {
        const pastValue = sorted[windowStartIdx].value
        const currValue = sorted[i].value
        rolling = (currValue - pastValue) * 100
      }

      result.push({
        date: sorted[i].date,
        rolling12m: rolling,
      })
    }

    return result
  }, [baseSeries])

  // dados que REALMENTE vão pro gráfico (apenas onde existe rolling12m)
  const displayData: RollingPoint[] = useMemo(
    () => rollingAll.filter((p) => typeof p.rolling12m === 'number'),
    [rollingAll]
  )

  // domínio e estatísticas só em cima dos pontos que já têm 12m calculados
  const numericValues = displayData
    .map((d) => d.rolling12m)
    .filter((v): v is number => typeof v === 'number')

  const average =
    numericValues.length > 0
      ? numericValues.reduce((acc, v) => acc + v, 0) / numericValues.length
      : 0

  const rawMin = numericValues.length ? Math.min(...numericValues) : 0
  const rawMax = numericValues.length ? Math.max(...numericValues) : 0
  const padding = (rawMax - rawMin) * 0.2 || 5

  const roundDownTo5 = (v: number) => Math.floor(v / 5) * 5
  const roundUpTo5 = (v: number) => Math.ceil(v / 5) * 5

  let domainMin = roundDownTo5(rawMin - padding)
  let domainMax = roundUpTo5(rawMax + padding)

  if (rawMin >= 0 && domainMin < 0) {
    domainMin = 0
  }
  if (rawMax <= 0 && domainMax > 0) {
    domainMax = 0
  }

  const domain: [number, number] = [domainMin, domainMax]

  const yTicks: number[] = []
  for (let t = domainMin; t <= domainMax; t += 5) {
    yTicks.push(t)
  }

  // ticks mensais, só onde existe dado
  const xTicks = useMemo(() => {
    const ticks: string[] = []

    displayData.forEach((p) => {
      const d = dayjs(p.date)
      if (d.date() === 1) {
        ticks.push(p.date)
      }
    })

    return ticks.length ? ticks : displayData.map((p) => p.date)
  }, [displayData])

  if (!displayData.length || numericValues.length === 0) {
    return (
      <AppChartArea
        height={height}
        emptyMessage="São necessários pelo menos 12 meses de dados para exibir o retorno de 12 meses."
      />
    )
  }

  return (
    <AppChartArea height={height} toolbar={<SectionTitle>Retorno 12 meses</SectionTitle>}>
      <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              interval={0}
              minTickGap={0}
              stroke={labelColor}
              tickFormatter={(v) => {
                const d = dayjs(v as string)
                return d.month() === 0 ? d.format('MM/YY') : d.format('MM')
              }}
            />
            <YAxis
              orientation="right"
              domain={domain}
              ticks={yTicks}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              stroke={labelColor}
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value as number).toFixed(2)}%`,
                'Retorno 12 meses',
              ]}
              labelFormatter={(label) =>
                `Data: ${dayjs(label as string).format('DD/MM/YY')}`
              }
            />

            <ReferenceLine
              y={average}
              stroke={averageLineColor}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />

            <Line
              type="monotone"
              dataKey="rolling12m"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Retorno 12 meses"
            />
          </LineChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
