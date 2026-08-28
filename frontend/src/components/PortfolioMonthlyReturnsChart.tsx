// src/components/PortfolioMonthlyReturnsChart.tsx
import { defaultRangeOptionsFromOldest } from '@/components/charts/app-bar-chart/helpers'
import DateRangeMenu from '@/components/charts/shared/DateRangeMenu'
import { baseChartOptions } from '@/components/portfolio-asset/chart'
import { AppChartArea, AppStack, SectionTitle, useAppTheme } from '@/components/ui'
import { getDateFromRange, type DateRangeKey } from '@/lib/utils/date'
import dayjs from 'dayjs'
import {
    createChart,
    HistogramSeries,
    type HistogramData,
    type IChartApi,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'

interface SeriesPoint {
  date: string
  value: number
}

interface Props {
  height?: number
  defaultRange?: string
  data: SeriesPoint[]
}

/** Quanto cada mês rendeu, em barras.
 *
 *  Desenhado com a mesma biblioteca de canvas do gráfico de rentabilidade, e
 *  não mais com o recharts: o eixo de meses de uma carteira antiga não cabe na
 *  largura do card, e sem poder aproximar a leitura de um trecho vira contagem
 *  de barras. O seletor de período continua ali para o recorte grosso; o zoom e
 *  o arraste ficam com o gráfico. */
export default function PortfolioMonthlyReturnsChart({
  height = 260,
  defaultRange = '1y',
  data,
}: Props) {
  const theme = useAppTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const [range, setRange] = useState<DateRangeKey>(defaultRange as DateRangeKey)

  const baseSeries: SeriesPoint[] = useMemo(() => data || [], [data])

  const fromISO = useMemo(
    () => (range === 'max' ? null : getDateFromRange(range).format('YYYY-MM-DD')),
    [range],
  )

  const filteredSeries: SeriesPoint[] = useMemo(() => {
    if (!baseSeries.length) return []
    if (!fromISO) return baseSeries
    return baseSeries.filter((p) => p.date >= fromISO)
  }, [baseSeries, fromISO])

  /** O retorno de um mês é a variação entre o primeiro ponto dele e o primeiro
   *  do mês seguinte, e fica datado no mês a que pertence. */
  const monthlyData = useMemo(() => {
    if (!filteredSeries.length) return []

    const byMonth: Record<string, { date: string; value: number }> = {}
    for (const point of filteredSeries) {
      const monthKey = dayjs(point.date).format('YYYY-MM')
      if (!byMonth[monthKey] || point.date < byMonth[monthKey].date) {
        byMonth[monthKey] = { date: point.date, value: point.value }
      }
    }

    const months = Object.keys(byMonth).sort()
    const result: { time: string; value: number }[] = []

    for (let i = 1; i < months.length; i++) {
      result.push({
        time: `${months[i - 1]}-01`,
        value: (byMonth[months[i]].value - byMonth[months[i - 1]].value) * 100,
      })
    }

    return result
  }, [filteredSeries])

  const rangeOptions = useMemo(
    () => defaultRangeOptionsFromOldest(baseSeries[0]?.date ?? null),
    [baseSeries],
  )

  useEffect(() => {
    if (!containerRef.current || !monthlyData.length) return

    const chart = createChart(containerRef.current, baseChartOptions(theme, height))

    const series = chart.addSeries(HistogramSeries, {
      base: 0,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => `${value.toFixed(1)}%`,
        minMove: 0.1,
      },
    })
    series.setData(
      monthlyData.map((point) => ({
        time: point.time as Time,
        value: point.value,
        color: point.value >= 0 ? theme.palette.success.main : theme.palette.error.main,
      })) as HistogramData<Time>[],
    )

    chart.timeScale().fitContent()
    chartRef.current = chart

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [monthlyData, height, theme])

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
      plotRef={containerRef}
      toolbar={
        <AppStack direction="row" justify="between" align="center" gap="md">
          <SectionTitle>Desempenho Mensal</SectionTitle>
          <DateRangeMenu show range={range} options={rangeOptions} onChange={setRange} />
        </AppStack>
      }
    />
  )
}
