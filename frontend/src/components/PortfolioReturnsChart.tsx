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
    Autocomplete,
    Box,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    TextField,
    Typography,
    useTheme,
} from '@mui/material'
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
  selectedAssets?: string[]
  defaultRange?: string
  onRangeChange?: (range: string) => void
  onCurveChange?: (curve: { kind: 'category' | 'benchmark' | 'asset'; key: string }) => void
  /** Guarda período e janela visível. Sem chave, o gráfico não lembra nada. */
  persistKey?: string
}

type SeriesKind = 'category' | 'benchmark' | 'asset'

interface SeriesOption {
  /** Identificador único: o mesmo nome pode existir em dois grupos. */
  id: string
  kind: SeriesKind
  /** Chave no store, que é como a série é encontrada. */
  key: string
  label: string
  group: string
}

const GROUP_LABEL: Record<SeriesKind, string> = {
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
    <Typography
      component="span"
      variant="body2"
      sx={{ fontWeight: 600, color: isPositive ? 'success.main' : 'error.main' }}
    >
      {positive === undefined && value >= 0 ? '+' : ''}
      {value.toFixed(2).replace('.', ',')}%
    </Typography>
  )
}

const optionId = (kind: SeriesKind, key: string) => `${kind}:${key}`

export default function PortfolioReturnsChart({
  size,
  selectedCategory,
  selectedBenchmark,
  selectedAssets = [],
  defaultRange,
  onRangeChange,
  onCurveChange,
  persistKey,
}: Props) {
  const { categoryReturns, assetReturns, benchmarks, loading } = useReturnsStore()
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const trades = useTradesStore((s) => s.trades)
  const positions = usePositionsStore((s) => s.positions)
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const { symbol: currencySymbol, format: formatCurrency } = useCurrency()

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useTheme()

  const restored = useRef(readChartState(persistKey)).current
  const [range, setRange] = useState<DateRangeKey>(
    (restored.range ?? (defaultRange as DateRangeKey) ?? 'max') as DateRangeKey,
  )
  const [showTrades, setShowTrades] = useState(restored.trades ?? true)
  const [hoveredFlow, setHoveredFlow] = useState<HoveredFlow | null>(null)
  const viewRef = useRef<PersistedView | null>(isValidView(restored.view) ? restored.view : null)

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
      ...build('category', Object.keys(categoryReturns)),
      ...build('benchmark', Object.keys(benchmarks)),
      ...build('asset', Object.keys(assetReturns)),
    ]
  }, [categoryReturns, benchmarks, assetReturns])

  // As séries pedidas por quem montou a página. Elas são o ponto de partida da
  // seleção, e o usuário mexe a partir daí.
  const initialIds = useMemo(() => {
    const ids: string[] = []
    if (selectedCategory) ids.push(optionId('category', selectedCategory === 'Carteira' ? 'portfolio' : selectedCategory))
    if (selectedBenchmark) ids.push(optionId('benchmark', selectedBenchmark))
    for (const asset of selectedAssets) ids.push(optionId('asset', asset))
    return ids
  }, [selectedCategory, selectedBenchmark, selectedAssets.join(',')])

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds)
  useEffect(() => setSelectedIds(initialIds), [initialIds])

  const selected = useMemo(
    () => options.filter((option) => selectedIds.includes(option.id)),
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
      byCategory[option.label] ??
      named[option.label] ??
      theme.palette.chart.colors[index % theme.palette.chart.colors.length]
  }, [userCategories, theme])

  const seriesByKey = useMemo(() => {
    const source: Record<SeriesKind, Record<string, { date: string; value: number }[]>> = {
      category: categoryReturns,
      benchmark: benchmarks,
      asset: assetReturns,
    }
    const map: Record<string, { date: string; value: number }[]> = {}
    for (const option of selected) map[option.id] = source[option.kind][option.key] ?? []
    return map
  }, [selected, categoryReturns, benchmarks, assetReturns])

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
    if (subject.key === 'portfolio') return trades

    const tickers = new Set(
      positions.filter((position) => position.category === subject.key).map((p) => p.ticker),
    )
    return trades.filter((trade) => tickers.has(trade.ticker))
  }, [subject, trades, positions])

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
    if (!containerRef.current || loading) return

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
    loading,
  ])

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 1.5 }}
      >
        {/* Um seletor só, com busca e agrupamento, no lugar de três menus de
            caixinhas: com trinta ativos na carteira, procurar um deles em uma
            lista sem busca é o gargalo — e as três listas separadas escondiam
            que tudo ali vira uma curva no mesmo gráfico. */}
        <Autocomplete
          multiple
          size="small"
          disableCloseOnSelect
          options={options}
          groupBy={(option) => option.group}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selected}
          onChange={(_, next) => {
            setSelectedIds(next.map((option) => option.id))
            const added = next.find((option) => !selectedIds.includes(option.id))
            if (added) onCurveChange?.({ kind: added.kind, key: added.key })
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index })
              return (
                <Chip
                  key={key}
                  {...tagProps}
                  size="small"
                  label={option.label}
                  sx={{
                    fontWeight: 600,
                    // A cor da curva no próprio marcador: é o que dispensa uma
                    // legenda separada embaixo do gráfico.
                    borderLeft: '3px solid',
                    borderLeftColor: colorOf(option, index),
                    borderRadius: 1,
                  }}
                />
              )
            })
          }
          renderInput={(params) => (
            <TextField {...params} placeholder={selected.length ? '' : 'Adicionar série'} />
          )}
          // Os três grupos lado a lado, e não empilhados: são listas curtas de
          // naturezas diferentes, e em coluna única a de ativos empurra as
          // outras duas para fora da tela.
          renderGroup={(params) => (
            <Box
              component="li"
              key={params.key}
              sx={{ flex: '1 1 0', minWidth: 150, px: 0.5, '&:not(:last-of-type)': { borderRight: '1px solid', borderRightColor: 'divider' } }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  px: 1.5,
                  py: 0.75,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {params.group}
              </Typography>
              <Box component="ul" sx={{ p: 0, m: 0, maxHeight: 280, overflowY: 'auto' }}>
                {params.children}
              </Box>
            </Box>
          )}
          slotProps={{
            listbox: { sx: { display: 'flex', alignItems: 'flex-start', maxHeight: 340, py: 0.5 } },
            // O menu é mais largo que o campo: são três colunas, e o campo ficou
            // estreito de propósito.
            popper: { style: { width: 'auto', minWidth: 480 }, placement: 'bottom-start' },
          }}
          sx={{ width: { xs: '100%', md: 380 } }}
        />

        {/* Sem operação para marcar — um benchmark sozinho, uma categoria sem
            posição — o controle não teria o que ligar. */}
        {weekFlows.length > 0 && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            <ToolbarSwitch label="Trades" checked={showTrades} onChange={setShowTrades} />
          </Stack>
        )}

        {/* A leitura da janela, no mesmo lugar e no mesmo registro do gráfico
            do ativo em carteira: o que o período rendeu, a que ritmo ao ano, e
            quanto disso passou do benchmark. */}
        {reading && (
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Período ({formatSpan(reading.performance.days)}){' '}
            <SignedPercent value={reading.performance.totalReturn * 100} />
            {reading.performance.cagr != null && (
              <>
                {' · CAGR '}
                <SignedPercent value={reading.performance.cagr * 100} />
              </>
            )}
            {reading.excess.map((entry) => (
              <Box component="span" key={entry.name}>
                {' · '}
                <SignedPercent value={Math.abs(entry.value)} positive={entry.value >= 0} />
                {entry.value >= 0 ? ' acima do ' : ' abaixo do '}
                {entry.name}
              </Box>
            ))}
          </Typography>
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
      </Stack>

      {loading ? (
        <Box height={size} display="flex" justifyContent="center" alignItems="center">
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Box ref={containerRef} sx={{ width: '100%' }} />
          {hoveredFlow && (
            <FlowTooltip
              hovered={hoveredFlow}
              formatCurrency={formatCurrency}
              containerWidth={containerRef.current?.clientWidth ?? 0}
            />
          )}
        </Box>
      )}
    </Box>
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
    <Box
      sx={{
        position: 'absolute',
        left,
        top: Math.max(y - 8, 0),
        width,
        pointerEvents: 'none',
        zIndex: 3,
        p: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 3,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {formatWeek(flow.from)}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: isBuy ? 'success.main' : 'error.main' }}
      >
        {isBuy ? 'Compras' : 'Vendas'} de {formatCurrency(Math.abs(flow.net))}
      </Typography>
      {bothSides && (
        <Typography variant="body2" color="text.secondary">
          {formatCurrency(flow.bought)} comprados · {formatCurrency(flow.sold)} vendidos
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {flow.count} {flow.count === 1 ? 'operação' : 'operações'}
      </Typography>
    </Box>
  )
}
