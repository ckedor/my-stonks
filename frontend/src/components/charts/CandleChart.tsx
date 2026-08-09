import { DateRangeKey, getDateFromRange } from '@/lib/utils/date'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import {
    alpha,
    Box,
    MenuItem,
    Select,
    Stack,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import {
    CandlestickData,
    CandlestickSeries,
    ColorType,
    createChart,
    HistogramSeries,
    IChartApi,
    LineData,
    LineSeries,
    PriceScaleMode,
    Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { defaultRangeOptionsFromOldest } from '../charts/app-bar-chart/helpers'
import DateRangeMenu, { RangeOption } from '../charts/shared/DateRangeMenu'
import {
    aggregateCandles,
    filterFrom,
    movingAverage,
    MOVING_AVERAGE_DAYS,
    MOVING_AVERAGE_PERIODS,
    periodPerformance,
    type CandleChartType,
    type CandleDataPoint,
    type CandleTimeframe,
} from './candle/helpers'
import {
    isValidView,
    readChartState,
    writeChartState,
    type PersistedView,
} from './candle/persistence'

dayjs.extend(isSameOrAfter)

export type { CandleChartType, CandleDataPoint, CandleTimeframe }

const percent = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

/** Pixels per candle the time scale may shrink to. The library default of 0.5
 *  caps a chart at roughly 2600 candles on a 1300px container; 0.02 clears
 *  60000, well past a lifetime of daily data. */
const MIN_BAR_SPACING = 0.02

interface CandleChartProps {
  data: CandleDataPoint[]
  height?: number
  showVolume?: boolean
  showVolumeToggle?: boolean
  showRangePicker?: boolean
  defaultRange?: DateRangeKey
  rangeOptions?: RangeOption[]
  showTimeframeSelector?: boolean
  defaultTimeframe?: CandleTimeframe
  /** Switch between candlesticks and a close-price line. */
  showTypeToggle?: boolean
  defaultType?: CandleChartType
  /** Switch the price axis between linear and logarithmic. */
  showLogToggle?: boolean
  /** Overlay a moving average of the close. */
  showMovingAverageToggle?: boolean
  /** Report return and CAGR for the visible window. */
  showPerformance?: boolean
  /** Remember the chosen options and the visible window under this key. Include
   *  whatever identifies the series (a ticker, say) so one chart's zoom is not
   *  restored onto another's. */
  persistKey?: string
}

export default function CandleChart({
  data,
  height = 400,
  showVolume = false,
  showVolumeToggle = false,
  showRangePicker = false,
  defaultRange = '1y',
  rangeOptions,
  showTimeframeSelector = false,
  defaultTimeframe = 'day',
  showTypeToggle = false,
  defaultType = 'candlestick',
  showLogToggle = false,
  showMovingAverageToggle = false,
  showPerformance = false,
  persistKey,
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useTheme()

  const restored = useRef(readChartState(persistKey)).current

  const [range, setRange] = useState<DateRangeKey>(restored.range ?? defaultRange)
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(
    restored.timeframe ?? defaultTimeframe,
  )
  const [volumeEnabled, setVolumeEnabled] = useState(restored.volume ?? showVolume)
  const [chartType, setChartType] = useState<CandleChartType>(restored.chartType ?? defaultType)
  const [logScale, setLogScale] = useState(restored.logScale ?? false)
  const [movingAverageEnabled, setMovingAverageEnabled] = useState(restored.movingAverage ?? false)

  // Seeded from storage, then kept in step with whatever the user pans or zooms
  // to, so re-rendering the chart does not throw the view away.
  const viewRef = useRef<PersistedView | null>(
    isValidView(restored.view) ? restored.view : null,
  )

  useEffect(() => {
    writeChartState(persistKey, {
      range,
      timeframe,
      chartType,
      logScale,
      movingAverage: movingAverageEnabled,
      volume: volumeEnabled,
    })
  }, [persistKey, range, timeframe, chartType, logScale, movingAverageEnabled, volumeEnabled])

  // Changing range or timeframe is a deliberate request for a different window,
  // so the remembered one is dropped and the chart refits.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    viewRef.current = null
    writeChartState(persistKey, { view: null })
  }, [range, timeframe, persistKey])

  const oldestDateISO = useMemo(() => {
    if (!data.length) return null
    return data.reduce((oldest, d) => (d.time < oldest ? d.time : oldest), data[0].time)
  }, [data])

  const effectiveRangeOptions = useMemo(() => {
    if (rangeOptions?.length) return rangeOptions
    return defaultRangeOptionsFromOldest(oldestDateISO)
  }, [rangeOptions, oldestDateISO])

  const didInitRange = useRef(false)
  useEffect(() => {
    if (!showRangePicker) {
      setRange('max')
      return
    }
    if (!effectiveRangeOptions.length || didInitRange.current) return
    const isOffered = (value?: DateRangeKey) =>
      value != null && effectiveRangeOptions.some((o) => o.value === value)
    // A remembered range wins, as long as this series still offers it.
    const next = isOffered(restored.range)
      ? restored.range!
      : isOffered(defaultRange)
        ? defaultRange
        : effectiveRangeOptions[0]?.value ?? 'max'
    setRange(next)
    didInitRange.current = true
  }, [showRangePicker, effectiveRangeOptions, defaultRange, restored.range])

  const aggregated = useMemo(() => aggregateCandles(data, timeframe), [data, timeframe])

  const fromISO = useMemo(
    () =>
      showRangePicker && range !== 'max' ? getDateFromRange(range).format('YYYY-MM-DD') : null,
    [showRangePicker, range],
  )

  const filtered = useMemo(() => filterFrom(aggregated, fromISO), [aggregated, fromISO])

  const movingAveragePeriod = MOVING_AVERAGE_PERIODS[timeframe]
  const movingAverageAvailable = movingAveragePeriod > 1

  // Averaged over the whole series and only then cut to the visible range, so a
  // 200-period average still has a value on the first visible candle instead of
  // spending the window warming up.
  const movingAverageData = useMemo(() => {
    if (!movingAverageEnabled || !movingAverageAvailable) return []
    return filterFrom(movingAverage(aggregated, movingAveragePeriod), fromISO)
  }, [aggregated, fromISO, movingAverageEnabled, movingAverageAvailable, movingAveragePeriod])

  const performance = useMemo(
    () => (showPerformance ? periodPerformance(filtered) : null),
    [showPerformance, filtered],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: theme.palette.text.secondary,
        fontFamily: theme.typography.fontFamily as string,
      },
      grid: {
        vertLines: { color: theme.palette.chart.grid },
        horzLines: { color: theme.palette.chart.grid },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: theme.palette.primary.main },
        horzLine: { labelBackgroundColor: theme.palette.primary.main },
      },
      rightPriceScale: {
        borderColor: theme.palette.divider,
        mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: theme.palette.divider,
        timeVisible: false,
        // The library floors bar spacing at 0.5px, so `fitContent` silently
        // dropped the oldest candles once a series outgrew the container:
        // 30 years of daily data needs ~3800px at that floor. Lowering it lets
        // the whole history fit.
        minBarSpacing: MIN_BAR_SPACING,
      },
    })

    if (chartType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: theme.palette.primary.main,
        lineWidth: 2,
      })
      lineSeries.setData(
        filtered.map((d) => ({ time: d.time as Time, value: d.close })) as LineData<Time>[],
      )
    } else {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: theme.palette.success.main,
        downColor: theme.palette.error.main,
        borderUpColor: theme.palette.success.main,
        borderDownColor: theme.palette.error.main,
        wickUpColor: theme.palette.success.main,
        wickDownColor: theme.palette.error.main,
      })
      candleSeries.setData(filtered as CandlestickData<Time>[])
    }

    // Plotted on the same price scale, so it follows the linear/log setting
    // and overlays candles and line alike.
    if (movingAverageData.length) {
      const averageSeries = chart.addSeries(LineSeries, {
        color: theme.palette.chart.colors[0],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      averageSeries.setData(movingAverageData as LineData<Time>[])
    }

    if (volumeEnabled && filtered.some((d) => d.volume != null)) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })

      volumeSeries.setData(
        filtered
          .filter((d) => d.volume != null)
          .map((d) => ({
            time: d.time as Time,
            value: d.volume!,
            color:
              d.close >= d.open
                ? alpha(theme.palette.success.main, 0.3)
                : alpha(theme.palette.error.main, 0.3),
          })),
      )
    }

    const timeScale = chart.timeScale()
    // A stored window can fall outside the data (a different series, a shorter
    // history), and the library rejects it. Falling back to the full fit keeps
    // the chart usable instead of blank.
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
    const onVisibleRangeChange = (visible: unknown) => {
      if (!isValidView(visible)) return
      viewRef.current = visible
      // Panning fires continuously; only the resting position is worth storing.
      clearTimeout(writeTimer)
      writeTimer = setTimeout(() => writeChartState(persistKey, { view: visible }), 300)
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
  }, [filtered, movingAverageData, height, volumeEnabled, chartType, logScale, theme, persistKey])

  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string) => {
    const control = (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Switch size="small" checked={checked} onChange={(_, v) => onChange(v)} />
      </Stack>
    )
    return hint ? <Tooltip title={hint}>{control}</Tooltip> : control
  }

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        rowGap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" spacing={2} alignItems="baseline">
          {performance && (
            <>
              <Stack direction="row" spacing={0.75} alignItems="baseline">
                <Typography variant="body2" color="text.secondary">
                  Período
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: performance.totalReturn >= 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {percent(performance.totalReturn)}
                </Typography>
              </Stack>
              {performance.cagr != null && (
                <Stack direction="row" spacing={0.75} alignItems="baseline">
                  <Typography variant="body2" color="text.secondary">
                    CAGR
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: performance.cagr >= 0 ? 'success.main' : 'error.main',
                    }}
                  >
                    {percent(performance.cagr)}
                  </Typography>
                </Stack>
              )}
            </>
          )}
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" rowGap={1}>
          {showVolumeToggle && toggle('Vol', volumeEnabled, setVolumeEnabled)}
          {showMovingAverageToggle &&
            movingAverageAvailable &&
            toggle(
              `MM${movingAveragePeriod}`,
              movingAverageEnabled,
              setMovingAverageEnabled,
              `Média móvel de ${MOVING_AVERAGE_DAYS} dias (${movingAveragePeriod} períodos)`,
            )}
          {showLogToggle &&
            toggle('Log', logScale, setLogScale, 'Escala logarítmica no eixo de preço')}

          {showTypeToggle && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={chartType}
              onChange={(_, value) => value && setChartType(value as CandleChartType)}
            >
              <ToggleButton value="candlestick" sx={{ px: 1, py: 0.25 }}>
                <Tooltip title="Velas">
                  <CandlestickChartIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="line" sx={{ px: 1, py: 0.25 }}>
                <Tooltip title="Linha">
                  <ShowChartIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {showTimeframeSelector && (
            <Select
              size="small"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as CandleTimeframe)}
              renderValue={(v) => (v === 'day' ? 'D' : v === 'week' ? 'S' : 'M')}
              sx={{ minWidth: 0, '.MuiSelect-select': { py: 0.5, px: 1, fontSize: 13 } }}
            >
              <MenuItem value="day">Diário</MenuItem>
              <MenuItem value="week">Semanal</MenuItem>
              <MenuItem value="month">Mensal</MenuItem>
            </Select>
          )}
          <DateRangeMenu
            show={showRangePicker}
            range={range}
            options={effectiveRangeOptions}
            onChange={setRange}
          />
        </Stack>
      </Stack>
      <div ref={containerRef} style={{ width: '100%' }} />
    </Box>
  )
}
