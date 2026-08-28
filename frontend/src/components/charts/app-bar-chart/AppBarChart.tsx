import {
  AppChartArea,
  AppChartSkeleton,
  AppSelect,
  AppStack,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import { DateRangeKey, getOldestDateISO } from '@/lib/utils/date'
import { createNumberFormatter } from '@/lib/utils/number'
import dayjs from 'dayjs'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import DateRangeMenu, { RangeOption } from '../shared/DateRangeMenu'
import {
    ColorMode,
    computeDomain,
    defaultRangeOptionsFromOldest,
    filterByRange,
    formatXAxisTick,
    GroupBy,
    groupTimeSeries,
    LabelSide,
    toDisplayValue,
    ValueType,
} from './helpers'

export interface TimeSeriesPoint {
  date: string
  value: number
}

interface Props {
  data: TimeSeriesPoint[]
  height?: number | string
  fitContainer?: boolean
  title?: string
  emptyMessage?: string
  loading?: boolean
  colorMode?: ColorMode
  labelSide?: LabelSide
  showRangePicker?: boolean
  defaultRange?: DateRangeKey
  rangeOptions?: RangeOption[]
  groupBy?: GroupBy
  showGroupBySelector?: boolean
  valueType?: ValueType
  currency?: string
  locale?: string
  fontSize?: number
  yTickStep?: number
  /** Formats a bar's value in the tooltip. Defaults to `valueType`'s format,
   *  which rounds money to whole units -- too coarse for a series priced per
   *  share, where the whole value lives in the cents. */
  valueFormatter?: (value: number) => string
  /** Names a bucket in the tooltip. Defaults to its exact date, which reads as
   *  a claim about a day when the bars are months or years. */
  tooltipLabelFormatter?: (dateISO: string) => string
}

function toSteppedDomain(
  domain: [number, number],
  step: number
): [number, number] {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const [min, max] = domain

  const start = Math.floor(min / safeStep) * safeStep
  const end = Math.ceil(max / safeStep) * safeStep

  if (start === end) return [start - safeStep, end + safeStep]
  return [start, end]
}

function buildTicks(domain: [number, number], step: number) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const [min, max] = domain

  const out: number[] = []
  for (let v = min; v <= max; v += safeStep) out.push(v)

  return out
}

function computeNiceTickStep(domain: [number, number], targetTicks = 5) {
  const span = Math.abs(domain[1] - domain[0])
  if (!Number.isFinite(span) || span === 0) return 1

  const roughStep = span / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return niceNormalized * magnitude
}

export function AppBarChart({
  data,
  height = 260,
  fitContainer = false,
  title,
  emptyMessage = 'Sem dados para exibir.',
  loading = false,
  colorMode = 'single',
  labelSide = 'left',
  showRangePicker = false,
  defaultRange = '1y',
  groupBy = 'day',
  showGroupBySelector = false,
  rangeOptions,
  valueType = 'percent',
  currency = 'BRL',
  locale = 'pt-BR',
  fontSize = 13,
  yTickStep,
  valueFormatter,
  tooltipLabelFormatter,
}: Props) {
  const theme = useAppTheme()

  const positiveColor = theme.palette.success.main
  const negativeColor = theme.palette.error.main
  const singleColor = theme.palette.primary.main

  const gridColor = theme.palette.chart?.grid ?? theme.palette.divider
  const labelColor = theme.palette.chart?.label ?? theme.palette.text.secondary

  const [currentGroupBy, setCurrentGroupBy] = useState<GroupBy>(groupBy)
  const [range, setRange] = useState<DateRangeKey>(defaultRange)

  useEffect(() => {
    setCurrentGroupBy(groupBy)
  }, [groupBy])

  const oldestDateISO = useMemo(() => getOldestDateISO(data ?? []), [data])

  const effectiveRangeOptions: RangeOption[] = useMemo(() => {
    if (rangeOptions?.length) return rangeOptions
    return defaultRangeOptionsFromOldest(oldestDateISO)
  }, [rangeOptions, oldestDateISO])

  const didInitRange = useRef(false)

  useEffect(() => {
    if (!showRangePicker) {
      if (range !== 'max') setRange('max')
      return
    }

    if (!effectiveRangeOptions.length) return
    if (didInitRange.current) return

    const next = effectiveRangeOptions.some((o) => o.value === defaultRange)
      ? defaultRange
      : effectiveRangeOptions[0]?.value ?? 'max'

    setRange(next)
    didInitRange.current = true
  }, [showRangePicker, effectiveRangeOptions, defaultRange, range])

  const filtered = useMemo(() => {
    if (!data?.length) return []
    if (!showRangePicker) return data
    return filterByRange(data, range)
  }, [data, showRangePicker, range])

  const grouped = useMemo(
    () => groupTimeSeries(filtered, currentGroupBy),
    [filtered, currentGroupBy]
  )

  const chartData = useMemo(
    () =>
      grouped.map((p) => ({
        date: p.date,
        y: toDisplayValue(p.value, valueType),
      })),
    [grouped, valueType]
  )

  const rawDomain = useMemo<[number, number]>(() => {
    return computeDomain(chartData.map((d) => d.y))
  }, [chartData])

  const effectiveYTickStep = useMemo(
    () => yTickStep ?? computeNiceTickStep(rawDomain),
    [rawDomain, yTickStep]
  )

  const steppedDomain = useMemo<[number, number]>(() => {
    return toSteppedDomain(rawDomain, effectiveYTickStep)
  }, [rawDomain, effectiveYTickStep])

  const yTicks = useMemo(() => {
    return buildTicks(steppedDomain, effectiveYTickStep)
  }, [steppedDomain, effectiveYTickStep])

  const formatAxisValue = useMemo(() => {
    return createNumberFormatter({
      kind: valueType,
      locale,
      currency,
      compact: valueType === 'currency',
    })
  }, [valueType, locale, currency])

  const formatTooltipValue = useMemo(() => {
    if (valueFormatter) return (value: unknown) => valueFormatter(Number(value))

    if (valueType === 'currency') {
      const sym = currency === 'BRL' ? 'R$' : 'US$'
      return (value: unknown) =>
        `${sym} ${Number(value).toLocaleString(locale, {
          maximumFractionDigits: 0,
        })}`
    }

    const base = createNumberFormatter({
      kind: valueType,
      locale,
      currency,
    })

    return (value: unknown) => base(Number(value))
  }, [valueType, locale, currency, valueFormatter])

  const tooltipLabel = useMemo(
    () => (label: unknown) =>
      tooltipLabelFormatter
        ? tooltipLabelFormatter(String(label))
        : `Data: ${dayjs(String(label)).format('DD/MM/YYYY')}`,
    [tooltipLabelFormatter]
  )

  if (loading)
    return <AppChartSkeleton height={height} toolbar={!!(title || showRangePicker || showGroupBySelector)} />

  if (!chartData.length) {
    return <AppChartArea height={height} emptyMessage={emptyMessage} />
  }

  const toolbar = (title || showRangePicker || showGroupBySelector) && (
    <AppStack direction="row" justify="between" align="center" gap="md">
      {title ? <SectionTitle>{title}</SectionTitle> : <span />}

      <AppStack direction="row" gap="md" align="center">
        {showGroupBySelector && (
          <AppSelect
            size="auto"
            options={[
              { value: 'day', label: 'Diário' },
              { value: 'week', label: 'Semanal' },
              { value: 'month', label: 'Mensal' },
              { value: 'year', label: 'Anual' },
            ]}
            value={currentGroupBy}
            onChange={(value) => setCurrentGroupBy(value as GroupBy)}
          />
        )}

        <DateRangeMenu
          show={showRangePicker}
          range={range}
          options={effectiveRangeOptions}
          onChange={setRange}
        />
      </AppStack>
    </AppStack>
  )

  return (
    <AppChartArea
      height={height}
      sizing={fitContainer ? 'frame' : 'chart'}
      toolbar={toolbar || undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          key={`${range}:${currentGroupBy}:${steppedDomain.join(':')}`}
          data={chartData}
          margin={{ left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />

          <XAxis
            dataKey="date"
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize }}
            tickFormatter={(v) => formatXAxisTick(String(v), currentGroupBy)}
          />

          <YAxis
            orientation={labelSide === 'right' ? 'right' : 'left'}
            domain={steppedDomain}
            ticks={yTicks}
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize }}
            tickFormatter={(v) => formatAxisValue(Number(v))}
          />

          <Tooltip
            formatter={(v) => formatTooltipValue(v)}
            contentStyle={{ fontSize }}
            labelFormatter={tooltipLabel}
            labelStyle={{ fontSize }}
          />

          <Bar dataKey="y" name="Valor">
            {chartData.map((entry, index) => {
              const fill =
                colorMode === 'single'
                  ? singleColor
                  : entry.y >= 0
                  ? positiveColor
                  : negativeColor

              return <Cell key={`cell-${index}`} fill={fill} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}

export default AppBarChart
