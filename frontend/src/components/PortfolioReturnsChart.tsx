import { defaultRangeOptionsFromOldest } from '@/components/charts/app-bar-chart/helpers'
import { formatSpan, periodPerformance } from '@/components/charts/candle/helpers'
import {
    isValidView,
    readChartState,
    writeChartState,
    type PersistedView,
} from '@/components/charts/candle/persistence'
import DateRangeMenu from '@/components/charts/shared/DateRangeMenu'
import ToolbarSwitch from '@/components/charts/shared/ToolbarSwitch'
import { baseChartOptions } from '@/components/portfolio-asset/chart'
import {
    abbreviateMoney,
    formatWeek,
    labelledTrades,
    snapFlowsToSeries,
    toWeekFlows,
    tradeMarkerId,
    tradeMarkerSize,
    type CashFlow,
} from '@/components/portfolio-asset/helpers'
import { useCurrency } from '@/hooks/useCurrency'
import { getDateFromRange, type DateRangeKey } from '@/lib/utils/date'
import { rebaseWindow } from '@/lib/utils/returns'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradesStore } from '@/stores/portfolio/trades'
import {
    AppChartArea,
    AppDivider,
    AppFloatingCard,
    AppMultiAutocomplete,
    AppStack,
    AppStackItem,
    AppText,
    useAppTheme,
} from '@/components/ui'
import {
    createChart,
    createSeriesMarkers,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type MouseEventParams,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  size: number
  selectedCategory?: string
  selectedBenchmark?: string
  selectedBenchmarks?: string[]
  selectedAssets?: string[]
  externalSeries?: ReturnsChartExternalSeries[]
  selectedExternalSeries?: string[]
  externalLoading?: boolean
  defaultRange?: string
  onRangeChange?: (range: string) => void
  onCurveChange?: (curve: { kind: SeriesKind; key: string }) => void
  /** Guarda período e janela visível. Sem chave, o gráfico não lembra nada. */
  persistKey?: string
}

const EMPTY_KEYS: string[] = []
const EMPTY_EXTERNAL_SERIES: ReturnsChartExternalSeries[] = []

export interface ReturnsChartExternalSeries {
  key: string
  label: string
  data: { date: string; value: number }[]
  color?: string
  assetIds?: number[]
}

type SeriesKind = 'external' | 'category' | 'benchmark' | 'asset'

interface SeriesOption {
  /** Identificador único: o mesmo nome pode existir em dois grupos. */
  id: string
  kind: SeriesKind
  /** Chave no store, que é como a série é encontrada. */
  key: string
  label: string
  group: string
  color?: string
  assetIds?: number[]
}

const GROUP_LABEL: Record<SeriesKind, string> = {
  external: 'Classes',
  category: 'Categorias',
  benchmark: 'Benchmarks',
  asset: 'Ativos',
}

const mapDisplayName = (key: string) => (key === 'portfolio' ? 'Carteira' : key)

/** Pontos percentuais com sinal, na cor do sinal. `positive` existe para o
 *  excesso, exibido em módulo com a direção dita por extenso. */
function SignedPercent({ value, positive }: { value: number; positive?: boolean }) {
  const isPositive = positive ?? value >= 0

  return (
    <AppText variant="bodySmall" weight="strong" tone={isPositive ? 'success' : 'danger'} inline>
      {positive === undefined && value >= 0 ? '+' : ''}
      {value.toFixed(2).replace('.', ',')}%
    </AppText>
  )
}

const optionId = (kind: SeriesKind, key: string) => `${kind}:${key}`

export default function PortfolioReturnsChart({
  size,
  selectedCategory,
  selectedBenchmark,
  selectedBenchmarks = EMPTY_KEYS,
  selectedAssets = EMPTY_KEYS,
  externalSeries = EMPTY_EXTERNAL_SERIES,
  selectedExternalSeries = EMPTY_KEYS,
  externalLoading = false,
  defaultRange,
  onRangeChange,
  onCurveChange,
  persistKey,
}: Props) {
  const { categoryReturns, assetReturns, benchmarks, loading } = useReturnsStore()
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const trades = useTradesStore((s) => s.trades)
  const positions = usePositionsStore((s) => s.positions)
  const userCategories = useMemo(
    () => selectedPortfolio?.custom_categories ?? [],
    [selectedPortfolio?.custom_categories],
  )
  const { symbol: currencySymbol, format: formatCurrency } = useCurrency()

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useAppTheme()

  const restored = useRef(readChartState(persistKey)).current
  const [range, setRange] = useState<DateRangeKey>(
    (restored.range ?? (defaultRange as DateRangeKey) ?? 'max') as DateRangeKey,
  )
  const [showTrades, setShowTrades] = useState(restored.trades ?? true)
  const [hoveredFlow, setHoveredFlow] = useState<HoveredFlow | null>(null)
  const viewRef = useRef<PersistedView | null>(isValidView(restored.view) ? restored.view : null)
  const selectedExternalKeys = selectedExternalSeries.join('\u0000')
  const selectedBenchmarkKeys = selectedBenchmarks.join('\u0000')
  const selectedAssetKeys = selectedAssets.join('\u0000')

  const options = useMemo<SeriesOption[]>(() => {
    const build = (kind: SeriesKind, keys: string[]) =>
      keys.map((key) => ({
        id: optionId(kind, key),
        kind,
        key,
        label: mapDisplayName(key),
        group: GROUP_LABEL[kind],
      }))

    return [
      ...externalSeries.map((series) => ({
        id: optionId('external', series.key),
        kind: 'external' as const,
        key: series.key,
        label: series.label,
        group: GROUP_LABEL.external,
        color: series.color,
        assetIds: series.assetIds,
      })),
      ...build('category', Object.keys(categoryReturns)),
      ...build('benchmark', Object.keys(benchmarks)),
      ...build('asset', Object.keys(assetReturns)),
    ]
  }, [externalSeries, categoryReturns, benchmarks, assetReturns])

  // As séries pedidas por quem montou a página. Elas são o ponto de partida da
  // seleção, e o usuário mexe a partir daí.
  const initialIds = useMemo(() => {
    const ids: string[] = []
    for (const series of selectedExternalKeys ? selectedExternalKeys.split('\u0000') : []) {
      ids.push(optionId('external', series))
    }
    if (selectedCategory) ids.push(optionId('category', selectedCategory === 'Carteira' ? 'portfolio' : selectedCategory))
    if (selectedBenchmark) ids.push(optionId('benchmark', selectedBenchmark))
    for (const benchmark of selectedBenchmarkKeys ? selectedBenchmarkKeys.split('\u0000') : []) {
      ids.push(optionId('benchmark', benchmark))
    }
    for (const asset of selectedAssetKeys ? selectedAssetKeys.split('\u0000') : []) {
      ids.push(optionId('asset', asset))
    }
    return ids
  }, [selectedExternalKeys, selectedCategory, selectedBenchmark, selectedBenchmarkKeys, selectedAssetKeys])

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  useEffect(() => setSelectedIds(initialIds), [initialIds])

  const selected = useMemo(
    () => selectedIds
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is SeriesOption => option !== undefined),
    [options, selectedIds],
  )

  const colorOf = useMemo(() => {
    const byCategory: Record<string, string> = {}
    for (const category of userCategories) byCategory[category.name] = category.color

    const named: Record<string, string> = {
      Carteira: theme.palette.primary.main,
      CDI: theme.palette.secondary.main,
      IFIX: '#00bc8c',
      'S&P500': '#e74c3c',
      IBOVESPA: '#A9A92A',
      IPCA: '#8e44ad',
      'USD/BRL': '#2980b9',
    }

    return (option: SeriesOption, index: number) =>
      option.color ??
      byCategory[option.label] ??
      named[option.label] ??
      theme.palette.chart.colors[index % theme.palette.chart.colors.length]
  }, [userCategories, theme])

  const seriesByKey = useMemo(() => {
    const source: Record<SeriesKind, Record<string, { date: string; value: number }[]>> = {
      external: Object.fromEntries(externalSeries.map((series) => [series.key, series.data])),
      category: categoryReturns,
      benchmark: benchmarks,
      asset: assetReturns,
    }
    const map: Record<string, { date: string; value: number }[]> = {}
    for (const option of selected) map[option.id] = source[option.kind][option.key] ?? []
    return map
  }, [selected, externalSeries, categoryReturns, benchmarks, assetReturns])

  const oldestDateISO = useMemo(() => {
    let oldest: string | null = null
    for (const points of Object.values(seriesByKey)) {
      for (const point of points) if (!oldest || point.date < oldest) oldest = point.date
    }
    return oldest
  }, [seriesByKey])

  const rangeOptions = useMemo(
    () => defaultRangeOptionsFromOldest(oldestDateISO),
    [oldestDateISO],
  )

  const fromISO = useMemo(
    () => (range === 'max' ? null : getDateFromRange(range).format('YYYY-MM-DD')),
    [range],
  )

  const window = useMemo(() => rebaseWindow(seriesByKey, fromISO), [seriesByKey, fromISO])

  /** A curva de que o gráfico fala: a primeira que não é benchmark — a
   *  carteira, uma categoria, um ativo. É nela que a leitura se apoia e é sobre
   *  ela que as operações são marcadas; um benchmark não tem operação. */
  const subject = useMemo(
    () => selected.find((option) => option.kind !== 'benchmark') ?? selected[0] ?? null,
    [selected],
  )

  /** As operações que pertencem ao sujeito.
   *
   *  A categoria de um ativo vem da posição atual, então um ativo zerado não é
   *  reconhecido por ela e suas operações ficam de fora do recorte por
   *  categoria — na carteira inteira, que não filtra nada, todas entram. */
  const subjectTrades = useMemo(() => {
    if (!subject || subject.kind === 'benchmark') return []
    if (subject.kind === 'asset') return trades.filter((trade) => trade.ticker === subject.key)
    if (subject.kind === 'external') {
      const assetIds = new Set(subject.assetIds ?? [])
      return trades.filter((trade) => assetIds.has(trade.asset_id))
    }
    if (subject.key === 'portfolio') return trades

    const tickers = new Set(
      positions.filter((position) => position.category === subject.key).map((p) => p.ticker),
    )
    return trades.filter((trade) => tickers.has(trade.ticker))
  }, [subject, trades, positions])

  const chartLoading = externalSeries.length > 0 ? externalLoading : loading

  // `value` já vem em reais: o backend guarda o preço em BRL e devolve a moeda
  // original em `original_price`, então a soma de uma carteira com ativos em
  // dólar continua sendo uma soma de valores comparáveis.
  const weekFlows = useMemo(
    () => toWeekFlows(subjectTrades.map((trade) => ({ date: String(trade.date), value: trade.value }))),
    [subjectTrades],
  )

  /** O que a janela desenhada diz, em números.
   *
   *  Os benchmarks selecionados viram a comparação. O excesso é a diferença
   *  aritmética entre as curvas no fim da janela, que é exatamente o vão
   *  visível no gráfico, já que todas partem de zero. */
  const reading = useMemo(() => {
    if (!subject) return null

    const points = window.byKey[subject.id] ?? []
    if (points.length < 2) return null

    // `1 + retorno` transforma a série rebaseada em uma de "preços" partindo de
    // 1, que é o que `periodPerformance` mede — junto com a regra de só
    // anualizar acima de um ano.
    const performance = periodPerformance(
      points.map((point) => ({ time: point.date, close: 1 + point.value })),
    )
    if (!performance) return null

    const subjectEnd = points.at(-1)!.value * 100
    const excess = selected
      .filter((option) => option.kind === 'benchmark' && option.id !== subject.id)
      .map((option) => {
        const end = (window.byKey[option.id] ?? []).at(-1)?.value
        return end == null ? null : { name: option.label, value: subjectEnd - end * 100 }
      })
      .filter((entry): entry is { name: string; value: number } => entry != null)

    return { subject, performance, excess }
  }, [subject, selected, window])

  useEffect(() => {
    writeChartState(persistKey, { range, trades: showTrades })
  }, [persistKey, range, showTrades])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    viewRef.current = null
    writeChartState(persistKey, { view: null })
  }, [range, persistKey])

  useEffect(() => {
    if (!containerRef.current || chartLoading) return

    const chart = createChart(containerRef.current, baseChartOptions(theme, size))

    // A série que os marcadores de operação seguem.
    let anchorSeries: ISeriesApi<'Line'> | null = null

    selected.forEach((option, index) => {
      const series = chart.addSeries(LineSeries, {
        color: colorOf(option, index),
        lineWidth: 2,
        title: option.label,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => `${value.toFixed(1)}%`,
          minMove: 0.1,
        },
      })
      series.setData(
        (window.byKey[option.id] ?? []).map((point) => ({
          time: point.date as Time,
          value: point.value * 100,
        })) as LineData<Time>[],
      )
      if (option.id === subject?.id) anchorSeries = series
    })

    // As semanas de operação sobre a curva do sujeito. O triângulo aponta para
    // cima quando a semana foi de compra líquida; o tamanho é o do dinheiro
    // movimentado, e só as cinco maiores levam a cifra escrita — um rótulo ocupa
    // muito mais largura que um triângulo.
    const hovered = new Map<string, CashFlow>()
    if (showTrades && anchorSeries && window.dates.length) {
      const visible = snapFlowsToSeries(weekFlows, window.dates)
      const maxValue = visible.reduce((max, flow) => Math.max(max, Math.abs(flow.net)), 0)
      const labelled = labelledTrades(
        visible.map((flow) => ({ time: flow.time, value: Math.abs(flow.net) })),
      )

      const markers: SeriesMarker<Time>[] = visible.map((flow) => {
        const id = tradeMarkerId(flow.time)
        hovered.set(id, flow)
        return {
          id,
          time: flow.time as Time,
          position: flow.net > 0 ? 'belowBar' : 'aboveBar',
          shape: flow.net > 0 ? 'arrowUp' : 'arrowDown',
          color: flow.net > 0 ? theme.palette.success.main : theme.palette.error.main,
          size: tradeMarkerSize(flow.net, maxValue),
          text: labelled.has(flow.time)
            ? abbreviateMoney(Math.abs(flow.net), currencySymbol)
            : undefined,
        }
      })
      if (markers.length) createSeriesMarkers(anchorSeries, markers)
    }

    // A biblioteca não emite evento de hover por marcador; ela informa, no
    // movimento do crosshair, o id do objeto sob o cursor.
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      const id = param.hoveredObjectId
      const flow = typeof id === 'string' ? hovered.get(id) : undefined
      setHoveredFlow(flow && param.point ? { flow, x: param.point.x, y: param.point.y } : null)
    }
    chart.subscribeCrosshairMove(onCrosshairMove)

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
    const onVisibleRangeChange = (visible: unknown) => {
      if (!isValidView(visible)) return
      viewRef.current = visible
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
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      timeScale.unsubscribeVisibleTimeRangeChange(onVisibleRangeChange)
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [
    selected,
    subject,
    window,
    weekFlows,
    showTrades,
    currencySymbol,
    colorOf,
    size,
    theme,
    persistKey,
    chartLoading,
  ])

  return (
    <AppChartArea
      plotRef={containerRef}
      loading={chartLoading}
      height={chartLoading ? size : undefined}
      overlay={
        hoveredFlow && (
          <FlowTooltip
            hovered={hoveredFlow}
            formatCurrency={formatCurrency}
            containerWidth={containerRef.current?.clientWidth ?? 0}
          />
        )
      }
      toolbar={
        <AppStack direction="row" gap="md" justify="between" align="center" collapseBelow="md">
          {/* Um seletor só, com busca e agrupamento, no lugar de três menus de
              caixinhas: com trinta ativos na carteira, procurar um deles em uma
              lista sem busca é o gargalo — e as três listas separadas escondiam
              que tudo ali vira uma curva no mesmo gráfico. */}
          <AppMultiAutocomplete
            options={options}
            value={selected}
            placeholder="Adicionar série"
            tintOf={(option, index) => colorOf(option, index)}
            onChange={(next) => {
              setSelectedIds(next.map((option) => option.id))
              const added = next.find((option) => !selectedIds.includes(option.id))
              if (added) onCurveChange?.({ kind: added.kind, key: added.key })
            }}
          />

          {/* Sem operação para marcar — um benchmark sozinho, uma categoria sem
              posição — o controle não teria o que ligar. */}
          {weekFlows.length > 0 && (
            <AppStack direction="row" gap="sm" align="center">
              <AppDivider orientation="vertical" />
              <ToolbarSwitch label="Trades" checked={showTrades} onChange={setShowTrades} />
            </AppStack>
          )}

          {/* A leitura da janela, no mesmo lugar e no mesmo registro do gráfico
              do ativo em carteira: o que o período rendeu, a que ritmo ao ano, e
              quanto disso passou do benchmark. */}
          {/* Ocupa o espaço livre da barra: é o que mantém o seletor de
              período colado à direita e a leitura logo depois dos controles,
              em vez de os três se espalharem pela linha. */}
          {reading && (
            <AppStackItem grow={1}>
              <AppText variant="bodySmall" tone="secondary">
              Período ({formatSpan(reading.performance.days)}){' '}
              <SignedPercent value={reading.performance.totalReturn * 100} />
              {reading.performance.cagr != null && (
                <>
                  {' · CAGR '}
                  <SignedPercent value={reading.performance.cagr * 100} />
                </>
              )}
                {reading.excess.map((entry) => (
                  <AppText key={entry.name} variant="bodySmall" tone="secondary" inline>
                    {' · '}
                    <SignedPercent value={Math.abs(entry.value)} positive={entry.value >= 0} />
                    {entry.value >= 0 ? ' acima do ' : ' abaixo do '}
                    {entry.name}
                  </AppText>
                ))}
              </AppText>
            </AppStackItem>
          )}

          <DateRangeMenu
            show
            range={range}
            options={rangeOptions}
            onChange={(next) => {
              setRange(next)
              onRangeChange?.(next)
            }}
          />
        </AppStack>
      }
    />
  )
}

interface HoveredFlow {
  flow: CashFlow
  x: number
  y: number
}

/** A semana por extenso: o líquido que o marcador representa e, quando houve
 *  os dois lados, o bruto de cada um — sem isso, uma semana de troca de ativo
 *  apareceria como um evento quase nulo sem dizer por quê. */
function FlowTooltip({
  hovered,
  formatCurrency,
  containerWidth,
}: {
  hovered: HoveredFlow
  formatCurrency: (value: number) => string
  containerWidth: number
}) {
  const { flow, x, y } = hovered
  const isBuy = flow.net > 0
  const bothSides = flow.bought > 0 && flow.sold > 0
  const width = 210

  const left = x + width + 16 > containerWidth ? x - width - 12 : x + 12

  return (
    <AppFloatingCard left={left} top={Math.max(y - 8, 0)} width={width}>
      <AppText variant="caption" tone="secondary">
        {formatWeek(flow.from)}
      </AppText>
      <AppText variant="bodySmall" weight="strong" tone={isBuy ? 'success' : 'danger'}>
        {isBuy ? 'Compras' : 'Vendas'} de {formatCurrency(Math.abs(flow.net))}
      </AppText>
      {bothSides && (
        <AppText variant="bodySmall" tone="secondary">
          {formatCurrency(flow.bought)} comprados · {formatCurrency(flow.sold)} vendidos
        </AppText>
      )}
      <AppText variant="caption" tone="secondary">
        {flow.count} {flow.count === 1 ? 'operação' : 'operações'}
      </AppText>
    </AppFloatingCard>
  )
}
