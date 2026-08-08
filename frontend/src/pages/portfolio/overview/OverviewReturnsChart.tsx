import { useReturnsStore } from '@/stores/portfolio/returns'
import {
    Box,
    CircularProgress,
    MenuItem,
    Select,
    Stack,
    Typography,
    useTheme,
} from '@mui/material'
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
  const { categoryReturns, benchmarks, loading } = useReturnsStore()
  const theme = useTheme()

  const portfolioColor = theme.palette.primary.main
  const benchmarkColor = theme.palette.warning.main

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
    <Box sx={{ height: size, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header: returns + benchmark selector */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Stack direction="row" spacing={3} alignItems="baseline">
            <Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box sx={{ width: 3, height: 16, bgcolor: portfolioColor, borderRadius: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Carteira
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: portfolioReturn >= 0 ? 'success.main' : 'error.main',
                  ml: 1.4,
                  lineHeight: 1.2,
                }}
              >
                {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box sx={{ width: 3, height: 16, bgcolor: benchmarkColor, borderRadius: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  {selectedBenchmark}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: benchmarkReturn >= 0 ? 'success.main' : 'error.main',
                  ml: 1.4,
                  lineHeight: 1.2,
                }}
              >
                {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(1)}%
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Period selector */}
          <Stack direction="row" spacing={0.5}>
            {ranges.map((r) => (
              <Box
                key={r.value}
                onClick={() => setRange(r.value)}
                sx={{
                  px: 1.2,
                  py: 0.4,
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: range === r.value ? 600 : 400,
                  bgcolor: range === r.value ? 'action.selected' : 'transparent',
                  color: range === r.value ? 'text.primary' : 'text.secondary',
                  '&:hover': { bgcolor: 'action.hover' },
                  transition: 'all 0.15s',
                }}
              >
                {r.label}
              </Box>
            ))}
          </Stack>

          {/* Benchmark selector */}
          <Select
            value={selectedBenchmark}
            onChange={(e) => setSelectedBenchmark(e.target.value)}
            variant="outlined"
            size="small"
            MenuProps={{ disableScrollLock: true }}
            sx={{
              fontSize: 13,
              height: 32,
              minWidth: 90,
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'divider',
              },
            }}
          >
            {Object.keys(benchmarks).map((key) => (
              <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                {key}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>

      {/* Chart */}
      {loading ? (
        <Box sx={{ flex: 1, minHeight: 0 }} display="flex" justifyContent="center" alignItems="center">
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
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
              activeDot={{ r: 4, strokeWidth: 0, fill: portfolioColor }}
              name="portfolio"
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke={benchmarkColor}
              strokeWidth={1.8}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: benchmarkColor }}
              name="benchmark"
            />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  )
}
