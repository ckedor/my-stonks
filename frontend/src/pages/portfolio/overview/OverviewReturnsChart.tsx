import { EMPTY_MAP } from '@/queries/empty'
import { useBenchmarks, useReturnCurves } from '@/queries/portfolio'
import {
    AppChartArea,
    AppColorSwatch,
    AppInlineToggle,
    AppSelect,
    AppStack,
    AppText,
    useAppTheme,
} from '@/components/ui'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { useEffect, useMemo, useState } from 'react'
import {
    Area,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

dayjs.extend(isSameOrAfter)

interface Props {
  size?: number
  defaultRange?: string
  selectedCategory?: string
}

export default function OverviewReturnsChart({ size = 320, defaultRange = '1y', selectedCategory = 'portfolio' }: Props) {
  /* Fatiado, e não `useReturnsStore()` inteiro: sem seletor, o zustand
     reavalia esta tela a cada escrita em qualquer parte do store — inclusive
     em `assetReturns`, que este gráfico não lê. */
  const categoryReturns = useReturnCurves().series
  const benchmarks = useBenchmarks().data ?? EMPTY_MAP
  const loading = useReturnCurves().isPending
  const theme = useAppTheme()

  const portfolioColor = theme.palette.primary.main
  const benchmarkColor = theme.palette.warning.main

  /* Memorizados porque o recharts embrulha `Area` e `Line` em `React.memo`, e
     um objeto literal aqui furaria essa comparação a cada render: a série
     seria remontada e redesenhada do zero. A animação que sobra é a que
     interessa — a que roda quando o dado muda de verdade. */
  const portfolioActiveDot = useMemo(
    () => ({ r: 4, strokeWidth: 0, fill: portfolioColor }),
    [portfolioColor],
  )
  const benchmarkActiveDot = useMemo(
    () => ({ r: 3, strokeWidth: 0, fill: benchmarkColor }),
    [benchmarkColor],
  )

  const [selectedBenchmark, setSelectedBenchmark] = useState<string>('CDI')
  const [range, setRange] = useState(defaultRange)

  // Compute available year-based ranges
  const seriesKey = selectedCategory || 'portfolio'

  const allDates = useMemo(() => {
    const dateSet = new Set<string>()
    ;(categoryReturns[seriesKey] || []).forEach((d) => dateSet.add(d.date))
    ;(benchmarks[selectedBenchmark] || []).forEach((d) => dateSet.add(d.date))
    return Array.from(dateSet).sort()
  }, [categoryReturns, benchmarks, selectedBenchmark, seriesKey])

  const latestSeriesStart = useMemo(() => {
    const firstDates: string[] = []
    const pSeries = categoryReturns[seriesKey]
    if (pSeries?.length) firstDates.push([...pSeries].sort((a, b) => a.date.localeCompare(b.date))[0].date)
    const bSeries = benchmarks[selectedBenchmark]
    if (bSeries?.length) firstDates.push([...bSeries].sort((a, b) => a.date.localeCompare(b.date))[0].date)
    return firstDates.length ? firstDates.sort().at(-1)! : null
  }, [categoryReturns, benchmarks, selectedBenchmark, seriesKey])

  const totalMonths = allDates.length
    ? dayjs(allDates.at(-1)!).diff(dayjs(allDates[0]!), 'month')
    : 0
  const totalYears = Math.floor(totalMonths / 12)
  const currentYear = dayjs().year()

  const ranges = useMemo(() => {
    const base: { label: string; value: string }[] = [
      { label: `${currentYear}`, value: 'ytd' },
    ]
    if (totalMonths >= 6) base.push({ label: '6M', value: '6m' })
    for (let y = 1; y <= 5; y++) {
      if (y <= totalYears) base.push({ label: `${y}A`, value: `${y}y` })
    }
    base.push({ label: 'Max', value: 'max' })
    return base
  }, [totalYears, currentYear, totalMonths])

  // Reset range if not available
  useEffect(() => {
    if (!ranges.find((r) => r.value === range)) {
      setRange(ranges.at(-1)?.value ?? 'max')
    }
  }, [ranges, range])

  const filteredDates = useMemo(() => {
    const today = dayjs()
    let from: dayjs.Dayjs
    switch (range) {
      case 'ytd':
        from = today.startOf('year')
        break
      case '6m':
        from = today.subtract(6, 'month')
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
        from = latestSeriesStart ? dayjs(latestSeriesStart) : dayjs('1900-01-01')
    }
    return allDates.filter((date) => dayjs(date).isSameOrAfter(from))
  }, [allDates, range, latestSeriesStart])

  const normalizeReturns = (series: { date: string; value: number }[], dates: string[]) => {
    if (!dates.length) return []
    const sorted = [...series].sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
    const valuesMap = new Map(sorted.map((p) => [p.date, p.value]))
    const startDate = dates[0]
    let baseValue = 0
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (!dayjs(sorted[i].date).isAfter(startDate)) {
        baseValue = sorted[i].value
        break
      }
    }
    let lastKnown = baseValue
    return dates.map((date) => {
      if (valuesMap.has(date)) lastKnown = valuesMap.get(date)!
      const denom = 1 + baseValue
      const numer = 1 + lastKnown
      const rebased = denom > 0 ? (numer / denom) - 1 : 0
      return { date, value: rebased }
    })
  }

  const data = useMemo(() => {
    const map: Record<string, Record<string, number | string>> = {}
    filteredDates.forEach((date) => {
      map[date] = { date }
    })
    const pNorm = normalizeReturns(categoryReturns[seriesKey] || [], filteredDates)
    for (const { date, value } of pNorm) {
      if (map[date]) map[date]['portfolio'] = value * 100
    }
    const bNorm = normalizeReturns(benchmarks[selectedBenchmark] || [], filteredDates)
    for (const { date, value } of bNorm) {
      if (map[date]) map[date]['benchmark'] = value * 100
    }
    return Object.values(map).sort((a, b) => dayjs(a.date as string).unix() - dayjs(b.date as string).unix())
  }, [categoryReturns, benchmarks, selectedBenchmark, filteredDates, seriesKey])

  // Get return values for the period
  const portfolioReturn = data.length ? (data[data.length - 1]['portfolio'] as number) ?? 0 : 0
  const benchmarkReturn = data.length ? (data[data.length - 1]['benchmark'] as number) ?? 0 : 0

  const gradientId = 'overviewPortfolioGradient'

  return (
    <AppChartArea
      height={size}
      sizing="frame"
      loading={loading}
      toolbar={
        <AppStack direction="row" justify="between" align="start" gap="md">
          <AppStack direction="row" gap="lg" align="baseline">
            <SeriesLegend
              name="Carteira"
              color={portfolioColor}
              changePct={portfolioReturn}
            />
            <SeriesLegend
              name={selectedBenchmark}
              color={benchmarkColor}
              changePct={benchmarkReturn}
            />
          </AppStack>

          <AppStack direction="row" gap="md" align="center">
            <AppInlineToggle
              options={ranges}
              value={range}
              onChange={setRange}
            />
            <AppSelect
              size="auto"
              options={Object.keys(benchmarks).map((key) => ({ value: key, label: key }))}
              value={selectedBenchmark}
              onChange={setSelectedBenchmark}
            />
          </AppStack>
        </AppStack>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={portfolioColor} stopOpacity={0.12} />
              <stop offset="60%" stopColor={portfolioColor} stopOpacity={0.04} />
              <stop offset="100%" stopColor={portfolioColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              fontSize: 13,
            }}
            labelFormatter={(v) => dayjs(v).format('DD/MM/YYYY')}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)}%`,
              name === 'portfolio' ? 'Carteira' : selectedBenchmark,
            ]}
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke={portfolioColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={portfolioActiveDot}
            name="portfolio"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke={benchmarkColor}
            strokeWidth={1.8}
            dot={false}
            activeDot={benchmarkActiveDot}
            name="benchmark"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}

/* O nome de uma série com a marca da cor e o retorno dela no período — a
 * legenda que o gráfico não desenha porque os eixos estão escondidos. */
function SeriesLegend({
  name,
  color,
  changePct,
}: {
  name: string
  color: string
  changePct: number
}) {
  return (
    <AppStack gap="none">
      <AppStack direction="row" gap="xs" align="center">
        <AppColorSwatch color={color} shape="bar" />
        <AppText variant="bodySmall" tone="secondary">
          {name}
        </AppText>
      </AppStack>
      <AppText variant="bodySmall" weight="strong" tone={changePct >= 0 ? 'success' : 'danger'}>
        {changePct >= 0 ? '+' : ''}
        {changePct.toFixed(1)}%
      </AppText>
    </AppStack>
  )
}
