import { filterFrom } from '@/components/charts/candle/helpers'
import {
    isValidView,
    readChartState,
    writeChartState,
    type PersistedView,
} from '@/components/charts/candle/persistence'
import { defaultRangeOptionsFromOldest } from '@/components/charts/app-bar-chart/helpers'
import DateRangeMenu from '@/components/charts/shared/DateRangeMenu'
import { getDateFromRange, toISODate, type DateRangeKey } from '@/lib/utils/date'
import { AppChartArea, AppStack, useAppTheme } from '@/components/ui'
import {
    AreaSeries,
    createChart,
    type AreaData,
    type IChartApi,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { baseChartOptions } from './chart'
import { formatMoneyAxis, moneyMinMove } from './helpers'

interface Props {
  /** Série de patrimônio como vem de `/position/{id}/patrimony_evolution`. */
  data: { date: string; portfolio?: number | null }[]
  height?: number
  currencySymbol: string
  persistKey?: string
}

/** Quanto a posição vale, dia a dia.
 *
 *  Área, e não linha: o que se lê aqui é o tamanho da posição, uma grandeza
 *  acumulada, e a área diz isso antes de qualquer rótulo. Sem retorno de
 *  período no topo, ao contrário dos outros gráficos da página — este valor
 *  cresce com aporte também, então uma variação percentual aqui seria lida como
 *  rentabilidade sem ser. */
export default function PortfolioAssetPatrimonyChart({
  data,
  height = 320,
  currencySymbol,
  persistKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useAppTheme()

  const restored = useRef(readChartState(persistKey)).current
  const [range, setRange] = useState<DateRangeKey>(restored.range ?? 'max')

  const viewRef = useRef<PersistedView | null>(isValidView(restored.view) ? restored.view : null)

  useEffect(() => {
    writeChartState(persistKey, { range })
  }, [persistKey, range])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    viewRef.current = null
    writeChartState(persistKey, { view: null })
  }, [range, persistKey])

  const series = useMemo(() => {
    const byTime = new Map<string, number>()
    for (const entry of data) {
      if (entry.portfolio == null || !Number.isFinite(entry.portfolio)) continue
      byTime.set(toISODate(entry.date), entry.portfolio)
    }
    return [...byTime.entries()]
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [data])

  const rangeOptions = useMemo(
    () => defaultRangeOptionsFromOldest(series[0]?.time ?? null),
    [series],
  )

  const fromISO = useMemo(
    () => (range === 'max' ? null : getDateFromRange(range).format('YYYY-MM-DD')),
    [range],
  )

  const visible = useMemo(() => filterFrom(series, fromISO), [series, fromISO])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, baseChartOptions(theme, height))

    const maxValue = visible.reduce((max, point) => Math.max(max, point.value), 0)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: theme.palette.primary.main,
      topColor: `${theme.palette.primary.main}44`,
      bottomColor: `${theme.palette.primary.main}00`,
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => formatMoneyAxis(value, currencySymbol, maxValue),
        minMove: moneyMinMove(maxValue),
      },
    })
    areaSeries.setData(visible as AreaData<Time>[])

    const timeScale = chart.timeScale()
    let restoredView = false
    if (viewRef.current) {
      try {
        timeScale.setVisibleRange(viewRef.current as never)
        restoredView = true
      } catch {
        viewRef.current = null
      }
    }
    if (!restoredView) timeScale.fitContent()

    chartRef.current = chart

    let writeTimer: ReturnType<typeof setTimeout> | undefined
    const onVisibleRangeChange = (window: unknown) => {
      if (!isValidView(window)) return
      viewRef.current = window
      clearTimeout(writeTimer)
      writeTimer = setTimeout(() => writeChartState(persistKey, { view: window }), 300)
    }
    timeScale.subscribeVisibleTimeRangeChange(onVisibleRangeChange)

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      clearTimeout(writeTimer)
      timeScale.unsubscribeVisibleTimeRangeChange(onVisibleRangeChange)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [visible, height, currencySymbol, theme, persistKey])

  return (
    <AppChartArea
      plotRef={containerRef}
      toolbar={
        <AppStack direction="row" justify="end">
          <DateRangeMenu show range={range} options={rangeOptions} onChange={setRange} />
        </AppStack>
      }
    />
  )
}
