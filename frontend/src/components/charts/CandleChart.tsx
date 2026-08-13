import { DateRangeKey, getDateFromRange } from '@/lib/utils/date'
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import StraightenIcon from '@mui/icons-material/Straighten'
import {
    alpha,
    Box,
    Divider,
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
    MouseEventParams,
    PriceScaleMode,
    Time,
} from 'lightweight-charts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultRangeOptionsFromOldest } from '../charts/app-bar-chart/helpers'
import DateRangeMenu, { RangeOption } from '../charts/shared/DateRangeMenu'
import {
    aggregateCandles,
    candleAt,
    filterFrom,
    formatSpan,
    movingAverage,
    MOVING_AVERAGE_DAYS,
    MOVING_AVERAGE_PERIODS,
    periodPerformance,
    type CandleChartType,
    type CandleDataPoint,
    type CandlePriceSeries,
    type CandleTimeframe,
    type MeasureAnchor,
} from './candle/helpers'
import { MeasurePrimitive } from './candle/MeasurePrimitive'
import {
    isValidView,
    readChartState,
    readPriceScaleMode,
    writeChartState,
    type PersistedView,
    type PriceScaleMode as PriceScaleModeKey,
} from './candle/persistence'

dayjs.extend(isSameOrAfter)

export type { CandleChartType, CandleDataPoint, CandlePriceSeries, CandleTimeframe }

const percent = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`

/** Pixels per candle the time scale may shrink to. The library default of 0.5
 *  caps a chart at roughly 2600 candles on a 1300px container; 0.02 clears
 *  60000, well past a lifetime of daily data. */
const MIN_BAR_SPACING = 0.02

/** The library exposes one price-scale mode, so linear, log and percentage are
 *  three settings of the same field and only one can be active. */
const PRICE_SCALE_MODES: Record<PriceScaleModeKey, PriceScaleMode> = {
  linear: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  percent: PriceScaleMode.Percentage,
}

const PRICE_SCALE_MODE_OPTIONS: {
  value: PriceScaleModeKey
  label: string
  hint: string
}[] = [
  { value: 'linear', label: 'Lin', hint: 'Escala linear de preço' },
  { value: 'log', label: 'Log', hint: 'Escala logarítmica de preço' },
  { value: 'percent', label: '%', hint: 'Variação percentual desde o início da janela visível' },
]

const PRICE_SERIES_OPTIONS: { value: CandlePriceSeries; label: string; hint: string }[] = [
  {
    value: 'traded',
    label: 'Preço',
    hint: 'Preço negociado no pregão',
  },
  {
    value: 'adjusted',
    label: 'Ajust.',
    hint:
      'Fechamento ajustado por proventos e desdobramentos: a série comparável ' +
      'ao longo do tempo, e a que mede o retorno de quem carregou o ativo',
  },
]

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
  /** Offer the adjusted series, when the data carries one. */
  showPriceSeriesToggle?: boolean
  defaultPriceSeries?: CandlePriceSeries
  /** Offer the linear / logarithmic / percentage price axis selector. */
  showPriceScaleModeToggle?: boolean
  defaultPriceScaleMode?: PriceScaleModeKey
  /** Offer the two-click measurement tool. */
  showMeasureToggle?: boolean
  /** Formats prices on the axis and in the crosshair. Skipped on the percentage
   *  axis, which formats itself. */
  priceFormatter?: (value: number) => string
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
  showPriceSeriesToggle = false,
  defaultPriceSeries = 'traded',
  showPriceScaleModeToggle = false,
  defaultPriceScaleMode = 'linear',
  showMeasureToggle = false,
  priceFormatter,
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
  const [priceSeries, setPriceSeries] = useState<CandlePriceSeries>(
    restored.priceSeries ?? defaultPriceSeries,
  )
  const [priceScaleMode, setPriceScaleMode] = useState<PriceScaleModeKey>(
    readPriceScaleMode(restored) ?? defaultPriceScaleMode,
  )
  const [measureEnabled, setMeasureEnabled] = useState(restored.measure ?? false)
  const [movingAverageEnabled, setMovingAverageEnabled] = useState(restored.movingAverage ?? false)

  // Seeded from storage, then kept in step with whatever the user pans or zooms
  // to, so re-rendering the chart does not throw the view away.
  const viewRef = useRef<PersistedView | null>(
    isValidView(restored.view) ? restored.view : null,
  )

  // Measurement anchors live outside React state for the same reason as the
  // view: the effect below rebuilds the chart on every option change, and a
  // measurement in progress must survive that.
  const anchorsRef = useRef<MeasureAnchor[]>([])

  // Callers pass a formatter built from the current currency, which is a new
  // function on every render. Handing that straight to the effect would rebuild
  // the whole chart each time, so the effect depends on a stable wrapper and
  // only on *whether* a formatter exists. The library calls the wrapper as it
  // paints, so it always reaches the latest one.
  const priceFormatterRef = useRef(priceFormatter)
  priceFormatterRef.current = priceFormatter
  const hasPriceFormatter = priceFormatter != null
  const formatPrice = useCallback((value: number) => priceFormatterRef.current!(value), [])

  // Turning the tool off clears what it drew, so it never lingers as a stale
  // overlay over a different window.
  useEffect(() => {
    if (!measureEnabled) anchorsRef.current = []
  }, [measureEnabled])

  useEffect(() => {
    if (!measureEnabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMeasureEnabled(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [measureEnabled])

  useEffect(() => {
    writeChartState(persistKey, {
      range,
      timeframe,
      chartType,
      priceSeries,
      priceScaleMode,
      measure: measureEnabled,
      movingAverage: movingAverageEnabled,
      volume: volumeEnabled,
    })
  }, [
    persistKey,
    range,
    timeframe,
    chartType,
    priceSeries,
    priceScaleMode,
    measureEnabled,
    movingAverageEnabled,
    volumeEnabled,
  ])

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

  // Only worth offering where it says something the traded price does not: a
  // series the provider never adjusted is identical to it.
  const hasAdjustedSeries = useMemo(
    () => data.some((d) => d.adjustedClose != null && d.adjustedClose !== d.close),
    [data],
  )
  const adjusted = showPriceSeriesToggle && hasAdjustedSeries && priceSeries === 'adjusted'

  // The adjusted series is a single reconstructed price per day -- there is no
  // open, high or low that was ever traded at those levels -- so it is drawn as
  // a line, and everything read off the chart (return, average, ruler) reads
  // the same price as the line.
  const series = useMemo(
    () => (adjusted ? data.map((d) => ({ ...d, close: d.adjustedClose ?? d.close })) : data),
    [data, adjusted],
  )
  const effectiveType: CandleChartType = adjusted ? 'line' : chartType

  const aggregated = useMemo(() => aggregateCandles(series, timeframe), [series, timeframe])

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
        mode: PRICE_SCALE_MODES[priceScaleMode],
      },
      // The percentage axis formats itself relative to the first visible bar,
      // and a currency formatter would overwrite that with a price.
      ...(hasPriceFormatter && priceScaleMode !== 'percent'
        ? { localization: { priceFormatter: formatPrice } }
        : {}),
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

    let mainSeries
    if (effectiveType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: theme.palette.primary.main,
        lineWidth: 2,
      })
      lineSeries.setData(
        filtered.map((d) => ({ time: d.time as Time, value: d.close })) as LineData<Time>[],
      )
      mainSeries = lineSeries
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
      mainSeries = candleSeries
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
          .map((d, index, points) => {
            // The adjusted series has no open of its own, so the day is read
            // against the day before it instead of against itself.
            const previous = points[index - 1]
            const up = adjusted ? d.close >= (previous?.close ?? d.close) : d.close >= d.open
            return {
              time: d.time as Time,
              value: d.volume!,
              color: up
                ? alpha(theme.palette.success.main, 0.3)
                : alpha(theme.palette.error.main, 0.3),
            }
          }),
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

    // The chart is torn down and rebuilt whenever an option changes, so the
    // measurement is re-attached from the anchors kept outside React state --
    // the same trick that keeps the zoom from being thrown away.
    let measure: MeasurePrimitive | undefined
    let onClick: ((param: MouseEventParams<Time>) => void) | undefined
    if (measureEnabled) {
      measure = new MeasurePrimitive(
        {
          up: theme.palette.success.main,
          down: theme.palette.error.main,
          surface: theme.palette.background.paper,
          text: theme.palette.text.primary,
        },
        hasPriceFormatter ? formatPrice : undefined,
      )
      mainSeries.attachPrimitive(measure)
      measure.setAnchors(anchorsRef.current)

      onClick = (param) => {
        // Anchors snap to a candle rather than to the raw pointer. The library
        // reports the bar under the cursor, and a bar is drawn at its centre,
        // so a free-floating anchor lands beside the click -- and at the
        // minimum bar spacing a single pixel covers several candles anyway.
        // Snapping to the close also makes the reading match the period return
        // in the header, which is close-to-close.
        const candle = candleAt(filtered, param.logical)
        if (!candle) return
        measure!.addAnchor({ time: candle.time, price: candle.close })
        anchorsRef.current = measure!.getAnchors()
      }
      chart.subscribeClick(onClick)
      // Dragging places the second point; without this it would pan instead.
      chart.applyOptions({ handleScroll: false, handleScale: false })
    }

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      clearTimeout(writeTimer)
      if (onClick) chart.unsubscribeClick(onClick)
      if (measure) mainSeries.detachPrimitive(measure)
      timeScale.unsubscribeVisibleTimeRangeChange(onVisibleRangeChange)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [
    filtered,
    movingAverageData,
    height,
    volumeEnabled,
    adjusted,
    effectiveType,
    priceScaleMode,
    measureEnabled,
    hasPriceFormatter,
    formatPrice,
    theme,
    persistKey,
  ])

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
                  Período ({formatSpan(performance.days)})
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
          {/* Tools act *on* the chart rather than changing what it plots, so
              they read as a pressable instrument and sit apart from the
              switches and selectors that change the view itself. */}
          {showMeasureToggle && (
            <>
              <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
              <Tooltip title="Régua: clique em duas velas para medir a variação entre elas. Esc para sair.">
                <ToggleButton
                  size="small"
                  value="measure"
                  selected={measureEnabled}
                  onChange={() => setMeasureEnabled((on) => !on)}
                  sx={{ px: 1, py: 0.25, gap: 0.5 }}
                >
                  <StraightenIcon fontSize="small" />
                  <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
                    Régua
                  </Typography>
                </ToggleButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            </>
          )}

          {showPriceScaleModeToggle && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={priceScaleMode}
              onChange={(_, value) => value && setPriceScaleMode(value as PriceScaleModeKey)}
            >
              {PRICE_SCALE_MODE_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value} sx={{ px: 1, py: 0.25 }}>
                  <Tooltip title={option.hint}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
                      {option.label}
                    </Typography>
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {showPriceSeriesToggle && hasAdjustedSeries && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={priceSeries}
              onChange={(_, value) => value && setPriceSeries(value as CandlePriceSeries)}
            >
              {PRICE_SERIES_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value} sx={{ px: 1, py: 0.25 }}>
                  <Tooltip title={option.hint}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
                      {option.label}
                    </Typography>
                  </Tooltip>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {showTypeToggle && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={effectiveType}
              onChange={(_, value) => value && setChartType(value as CandleChartType)}
            >
              <ToggleButton value="candlestick" disabled={adjusted} sx={{ px: 1, py: 0.25 }}>
                <Tooltip
                  title={
                    adjusted
                      ? 'A série ajustada é um preço reconstruído por dia, sem máxima e mínima negociadas'
                      : 'Velas'
                  }
                >
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
