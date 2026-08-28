// src/components/PortfolioRolling12mChart.tsx
import { baseChartOptions } from '@/components/portfolio-asset/chart'
import { AppChartArea, SectionTitle, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import {
    createChart,
    LineSeries,
    LineStyle,
    type IChartApi,
    type LineData,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef } from 'react'

interface SeriesPoint {
  date: string
  value: number
}

interface Props {
  height?: number
  data: SeriesPoint[]
}

/** O retorno dos últimos doze meses, dia a dia.
 *
 *  Desenhado com a biblioteca de canvas dos demais gráficos da página, o que dá
 *  zoom e arraste a uma série diária longa — sem isso, uma década de pontos
 *  cabia na largura do card como uma mancha. A média do período continua
 *  marcada como linha tracejada. */
export default function PortfolioRolling12mChart({ height = 260, data }: Props) {
  const theme = useAppTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const baseSeries: SeriesPoint[] = useMemo(() => data || [], [data])

  /** Só os dias que já têm doze meses de histórico atrás de si: antes disso a
   *  janela seria mais curta que o que o gráfico promete medir. */
  const displayData = useMemo(() => {
    if (!baseSeries.length) return []

    const sorted = [...baseSeries].sort((a, b) => a.date.localeCompare(b.date))
    const dates = sorted.map((p) => dayjs(p.date))
    const firstDate = dates[0]
    const result: { time: string; value: number }[] = []

    let windowStartIdx = 0

    for (let i = 0; i < sorted.length; i++) {
      const currentDate = dates[i]
      const windowStartDate = currentDate.subtract(12, 'month')

      while (windowStartIdx < i && dates[windowStartIdx].isBefore(windowStartDate)) {
        windowStartIdx++
      }

      if (currentDate.diff(firstDate, 'month') < 12) continue

      result.push({
        time: sorted[i].date,
        value: (sorted[i].value - sorted[windowStartIdx].value) * 100,
      })
    }

    return result
  }, [baseSeries])

  const average = useMemo(() => {
    if (!displayData.length) return 0
    return displayData.reduce((acc, p) => acc + p.value, 0) / displayData.length
  }, [displayData])

  useEffect(() => {
    if (!containerRef.current || !displayData.length) return

    const chart = createChart(containerRef.current, baseChartOptions(theme, height))

    const series = chart.addSeries(LineSeries, {
      color: theme.palette.primary.main,
      lineWidth: 2,
      title: 'Retorno 12 meses',
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => `${value.toFixed(1)}%`,
        minMove: 0.1,
      },
    })
    series.setData(displayData as LineData<Time>[])

    series.createPriceLine({
      price: average,
      color: theme.palette.text.secondary,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'média',
    })

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
  }, [displayData, average, height, theme])

  if (!displayData.length) {
    return (
      <AppChartArea
        height={height}
        emptyMessage="São necessários pelo menos 12 meses de dados para exibir o retorno de 12 meses."
      />
    )
  }

  return (
    <AppChartArea plotRef={containerRef} toolbar={<SectionTitle>Retorno 12 meses</SectionTitle>} />
  )
}
