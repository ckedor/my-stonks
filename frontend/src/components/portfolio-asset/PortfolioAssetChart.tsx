import { filterFrom, formatSpan, periodPerformance } from '@/components/charts/candle/helpers'
import {
    readChartState,
    writeChartState,
    isValidView,
    type PersistedView,
} from '@/components/charts/candle/persistence'
import DateRangeMenu from '@/components/charts/shared/DateRangeMenu'
import ToolbarSwitch from '@/components/charts/shared/ToolbarSwitch'
import { defaultRangeOptionsFromOldest } from '@/components/charts/app-bar-chart/helpers'
import { getDateFromRange, type DateRangeKey } from '@/lib/utils/date'
import { normalizeReturns } from '@/lib/utils/returns'
import { ReturnsEntry } from '@/types'
import { baseChartOptions } from './chart'
import dayjs from 'dayjs'
import {
    AppChartArea,
    AppDivider,
    AppFloatingCard,
    AppSelect,
    AppStack,
    AppText,
    AppToggleGroup,
    useAppTheme,
} from '@/components/ui'
import {
    createChart,
    createSeriesMarkers,
    LineSeries,
    LineStyle,
    type IChartApi,
    type LineData,
    type MouseEventParams,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    firstDate,
    formatDate,
    formatMonth,
    formatMoneyAxis,
    formatQuantity,
    labelledTrades,
    moneyMinMove,
    quantityMinMove,
    rollingCagrSeries,
    ROLLING_WINDOW_MONTHS,
    snapTradesToSeries,
    toDayTrades,
    toPositionSeries,
    tradeLabel,
    tradeMarkerId,
    tradeMarkerSize,
    type DayTrade,
    type PositionHistoryEntry,
    type TradeEntry,
} from './helpers'

/** O gráfico plota o retorno da posição ou o preço do ativo. Os dois contam a
 *  mesma história em escalas diferentes, então são um controle e não dois
 *  gráficos. */
export type AssetChartMode = 'rentabilidade' | 'preco' | 'anualizado'

const DEFAULT_BENCHMARK = 'CDI'

const MODE_OPTIONS: { value: AssetChartMode; label: string }[] = [
  { value: 'rentabilidade', label: 'Rentabilidade' },
  { value: 'preco', label: 'Preço' },
  { value: 'anualizado', label: 'Anualizado' },
]

interface HoveredTrade {
  trade: DayTrade
  x: number
  y: number
}

/** Escala própria para a quantidade, à esquerda: ela não tem nada a ver com a
 *  ordem de grandeza do preço, e dividir a escala achataria as duas. */
const QUANTITY_SCALE = 'left'

interface Props {
  history: PositionHistoryEntry[]
  trades: TradeEntry[]
  /** Retorno acumulado da posição no ativo, como vem de `/asset/{id}/returns`. */
  returns: ReturnsEntry[]
  /** Séries de benchmark disponíveis, por nome. */
  benchmarks: Record<string, ReturnsEntry[]>
  /** Retorno anualizado em janela móvel, já em pontos percentuais. Vazio
   *  esconde o modo: sem análise não há o que desenhar nele. */
  rollingCagr?: ReturnsEntry[]
  height?: number
  priceFormatter: (value: number) => string
  /** Símbolo da moeda corrente, para os rótulos abreviados das operações. */
  currencySymbol: string
  /** Guarda modo, sobreposições e janela visível. Inclua o ticker, para a
   *  janela de um ativo não ser restaurada sobre a de outro. */
  persistKey?: string
}

export default function PortfolioAssetChart({
  history,
  trades,
  returns,
  benchmarks,
  rollingCagr = [],
  height = 420,
  priceFormatter,
  currencySymbol,
  persistKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useAppTheme()

  const restored = useRef(readChartState(persistKey)).current

  const [storedMode, setMode] = useState<AssetChartMode>(
    restored.assetChartMode ?? 'rentabilidade',
  )
  const [showTrades, setShowTrades] = useState(restored.trades ?? true)
  const [showQuantity, setShowQuantity] = useState(restored.quantity ?? true)
  const [showAveragePrice, setShowAveragePrice] = useState(restored.averagePrice ?? true)
  const [benchmark, setBenchmark] = useState<string>(restored.benchmark ?? 'CDI')
  const [range, setRange] = useState<DateRangeKey>(restored.range ?? 'max')
  const [hoveredTrade, setHoveredTrade] = useState<HoveredTrade | null>(null)

  // Fora do estado do React pelo mesmo motivo do `CandleChart`: o efeito
  // reconstrói o gráfico a cada troca de opção, e a janela em que o usuário
  // está não pode ser jogada fora junto.
  const viewRef = useRef<PersistedView | null>(isValidView(restored.view) ? restored.view : null)

  // Guarda o modo escolhido, e não o que acabou sendo desenhado: um ativo sem
  // análise cai na rentabilidade, e gravar essa queda apagaria a preferência
  // para os ativos que oferecem o modo.
  useEffect(() => {
    writeChartState(persistKey, {
      assetChartMode: storedMode,
      trades: showTrades,
      quantity: showQuantity,
      averagePrice: showAveragePrice,
      benchmark,
      range,
    })
  }, [persistKey, storedMode, showTrades, showQuantity, showAveragePrice, benchmark, range])

  // Trocar de período é um pedido explícito por outra janela, então a janela
  // lembrada é descartada e o gráfico se reajusta. Trocar de modo não: o
  // usuário quer ver o mesmo trecho por outra medida.
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    viewRef.current = null
    writeChartState(persistKey, { view: null })
  }, [range, persistKey])

  const positions = useMemo(() => toPositionSeries(history), [history])
  const dayTrades = useMemo(() => toDayTrades(trades), [trades])
  const rolling = useMemo(() => rollingCagrSeries(rollingCagr), [rollingCagr])

  // O modo Anualizado só existe quando há série para ele. Um modo guardado que
  // este ativo não oferece cai na rentabilidade, em vez de desenhar nada.
  const modes = useMemo(
    () => MODE_OPTIONS.filter((option) => option.value !== 'anualizado' || rolling.length > 0),
    [rolling],
  )
  const mode = modes.some((option) => option.value === storedMode) ? storedMode : 'rentabilidade'

  const benchmarkNames = useMemo(() => Object.keys(benchmarks).sort(), [benchmarks])

  // Sempre há um benchmark, enquanto houver algum: comparar contra nada é uma
  // escolha que ninguém faz de propósito. Um nome guardado que a carteira não
  // oferece mais cai no CDI, e na falta dele no primeiro da lista.
  const activeBenchmark = benchmarkNames.includes(benchmark)
    ? benchmark
    : benchmarkNames.includes(DEFAULT_BENCHMARK)
      ? DEFAULT_BENCHMARK
      : (benchmarkNames[0] ?? null)

  // Os períodos oferecidos saem da série do ativo, nunca da do benchmark: não
  // faz sentido oferecer 5 anos de uma posição aberta há três meses.
  const oldestDateISO = positions[0]?.time ?? firstDate(returns)
  const rangeOptions = useMemo(
    () => defaultRangeOptionsFromOldest(oldestDateISO),
    [oldestDateISO],
  )

  const fromISO = useMemo(
    () => (range === 'max' ? null : getDateFromRange(range).format('YYYY-MM-DD')),
    [range],
  )

  const visiblePositions = useMemo(() => filterFrom(positions, fromISO), [positions, fromISO])
  const visibleRolling = useMemo(() => filterFrom(rolling, fromISO), [rolling, fromISO])

  /** O que a cotação fez na janela. Mede o ativo, não a posição — quanto a
   *  posição rendeu está no modo Rentabilidade, que considera aportes e
   *  proventos. */
  const performance = useMemo(
    () =>
      mode === 'preco'
        ? periodPerformance(visiblePositions.map((p) => ({ time: p.time, close: p.price })))
        : null,
    [mode, visiblePositions],
  )

  /** As curvas de rentabilidade, rebaseadas ao primeiro dia da janela para que
   *  todas partam de zero e a comparação seja lida direto no eixo. */
  const returnSeries = useMemo(() => {
    if (mode !== 'rentabilidade') return null

    const dates = new Set<string>()
    for (const point of returns) dates.add(point.date)
    if (activeBenchmark) for (const point of benchmarks[activeBenchmark]) dates.add(point.date)

    // Onde todas as curvas já existem. O CDI tem anos de série a mais que uma
    // posição aberta há alguns meses, e sem este corte "Max" abriria a janela
    // do benchmark, com o ativo preenchido em zero num trecho em que ele ainda
    // não existia. Se um benchmark começasse depois do ativo, o corte seria no
    // benchmark pelo mesmo motivo — o começo comum é o último dos começos.
    const firstDates = [returns, activeBenchmark ? benchmarks[activeBenchmark] : []]
      .map(firstDate)
      .filter((date): date is string => date != null)
    const commonStart = firstDates.length ? firstDates.sort().at(-1)! : null

    const start = [fromISO, commonStart].filter((d): d is string => d != null).sort().at(-1) ?? null

    const visibleDates = [...dates]
      .sort()
      .filter((date) => !start || date >= start)

    const toLine = (series: ReturnsEntry[]) =>
      normalizeReturns(series, visibleDates).map((point) => ({
        time: point.date as Time,
        value: point.value * 100,
      })) as LineData<Time>[]

    const asset = toLine(returns)
    const benchmarkLine = activeBenchmark ? toLine(benchmarks[activeBenchmark]) : null

    // A distância entre as duas curvas no fim da janela — exatamente o vão que
    // se vê no gráfico, já que as duas partem de zero no primeiro dia dela.
    // Diferença aritmética, e não composta: é o que se lê no eixo.
    const assetEnd = asset.at(-1)?.value
    const benchmarkEnd = benchmarkLine?.at(-1)?.value
    const excess =
      assetEnd != null && benchmarkEnd != null ? assetEnd - benchmarkEnd : null

    const first = visibleDates[0] ?? null
    const last = visibleDates.at(-1) ?? null

    return {
      dates: visibleDates,
      asset,
      benchmark: benchmarkLine,
      start: first,
      excess,
      // Quanto a posição rendeu na janela: as curvas partem de zero no primeiro
      // dia dela, então o último valor da curva do ativo *é* o retorno do
      // período. Em razão, para casar com o que `periodPerformance` devolve.
      totalReturn: assetEnd != null ? assetEnd / 100 : null,
      days: first && last ? dayjs(last).diff(dayjs(first), 'day') : 0,
    }
  }, [mode, returns, benchmarks, activeBenchmark, fromISO])

  useEffect(() => {
    if (!containerRef.current) return

    // Sem `localization.priceFormatter`: ele é do gráfico inteiro e vence o
    // formato da série, então o eixo da quantidade saía em dinheiro. Cada
    // série traz o seu, e cada escala herda o da série que a ocupa.
    const chart = createChart(containerRef.current, baseChartOptions(theme, height))

    const percentFormat = {
      type: 'custom' as const,
      formatter: (value: number) => `${value.toFixed(1)}%`,
      minMove: 0.1,
    }

    // A série que os marcadores de operação seguem: a curva principal do modo.
    let anchorSeries = null as ReturnType<IChartApi['addSeries']> | null
    let anchorTimes: string[] = []

    if (mode === 'preco') {
      const maxPrice = visiblePositions.reduce(
        (max, p) => Math.max(max, p.price, p.averagePrice),
        0,
      )
      const moneyFormat = {
        type: 'custom' as const,
        formatter: (value: number) => formatMoneyAxis(value, currencySymbol, maxPrice),
        minMove: moneyMinMove(maxPrice),
      }

      const priceSeries = chart.addSeries(LineSeries, {
        color: theme.palette.primary.main,
        lineWidth: 2,
        title: 'Cotação',
        priceFormat: moneyFormat,
      })
      priceSeries.setData(
        visiblePositions.map((p) => ({ time: p.time as Time, value: p.price })) as LineData<Time>[],
      )
      anchorSeries = priceSeries
      anchorTimes = visiblePositions.map((p) => p.time)

      if (showAveragePrice) {
        const averageSeries = chart.addSeries(LineSeries, {
          color: theme.palette.error.main,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          title: 'Preço médio',
          priceFormat: moneyFormat,
        })
        averageSeries.setData(
          visiblePositions.map((p) => ({
            time: p.time as Time,
            value: p.averagePrice,
          })) as LineData<Time>[],
        )
      }

      if (showQuantity) {
        const maxQuantity = visiblePositions.reduce((max, p) => Math.max(max, p.quantity), 0)
        const quantitySeries = chart.addSeries(LineSeries, {
          color: theme.palette.chart.colors[0],
          lineWidth: 1,
          priceScaleId: QUANTITY_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
          title: 'Quantidade',
          // Quantidade não é dinheiro. O formatador de moeda é do gráfico
          // inteiro (a biblioteca só tem um), então a série o sobrescreve para
          // a própria escala — senão o eixo da esquerda sairia em R$.
          priceFormat: {
            type: 'custom',
            formatter: (value: number) => formatQuantity(value, maxQuantity),
            minMove: quantityMinMove(maxQuantity),
          },
        })
        quantitySeries.setData(
          visiblePositions.map((p) => ({
            time: p.time as Time,
            value: p.quantity,
          })) as LineData<Time>[],
        )
        chart.priceScale(QUANTITY_SCALE).applyOptions({
          visible: true,
          borderColor: theme.palette.divider,
          scaleMargins: { top: 0.75, bottom: 0 },
        })
      }
    } else if (mode === 'anualizado') {
      const rollingSeries = chart.addSeries(LineSeries, {
        color: theme.palette.primary.main,
        lineWidth: 2,
        title: 'Anualizado',
        priceFormat: percentFormat,
      })
      rollingSeries.setData(
        visibleRolling.map((point) => ({
          time: point.time as Time,
          value: point.value,
        })) as LineData<Time>[],
      )
      anchorSeries = rollingSeries
      anchorTimes = visibleRolling.map((point) => point.time)
    } else if (returnSeries) {
      const assetSeries = chart.addSeries(LineSeries, {
        color: theme.palette.primary.main,
        lineWidth: 2,
        title: 'Ativo',
        priceFormat: percentFormat,
      })
      assetSeries.setData(returnSeries.asset)
      anchorSeries = assetSeries
      anchorTimes = returnSeries.dates

      if (returnSeries.benchmark) {
        const benchmarkSeries = chart.addSeries(LineSeries, {
          color: theme.palette.secondary.main,
          lineWidth: 2,
          priceLineVisible: false,
          title: activeBenchmark ?? '',
          priceFormat: percentFormat,
        })
        benchmarkSeries.setData(returnSeries.benchmark)
      }
    }

    // As operações são as mesmas nos dois modos: mudam de altura, não de data.
    const hovered = new Map<string, DayTrade>()
    if (showTrades && anchorSeries && anchorTimes.length) {
      const visible = snapTradesToSeries(dayTrades, anchorTimes)
      const maxValue = visible.reduce((max, t) => Math.max(max, t.value), 0)
      const labelled = labelledTrades(visible)

      const markers: SeriesMarker<Time>[] = visible.map((trade) => {
        const id = tradeMarkerId(trade.time)
        hovered.set(id, trade)
        return {
          id,
          time: trade.time as Time,
          position: trade.quantity > 0 ? 'belowBar' : 'aboveBar',
          shape: trade.quantity > 0 ? 'arrowUp' : 'arrowDown',
          color: trade.quantity > 0 ? theme.palette.success.main : theme.palette.error.main,
          size: tradeMarkerSize(trade.value, maxValue),
          text: labelled.has(trade.time) ? tradeLabel(trade, currencySymbol) : undefined,
        }
      })
      if (markers.length) createSeriesMarkers(anchorSeries, markers)
    }

    // A biblioteca não emite evento de hover por marcador; ela informa, no
    // movimento do crosshair, o id do objeto sob o cursor. É por esse id que a
    // operação é reencontrada.
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      const id = param.hoveredObjectId
      const trade = typeof id === 'string' ? hovered.get(id) : undefined
      setHoveredTrade(trade && param.point ? { trade, x: param.point.x, y: param.point.y } : null)
    }
    chart.subscribeCrosshairMove(onCrosshairMove)

    const timeScale = chart.timeScale()
    // Uma janela guardada pode não existir nesta série (outro ativo, histórico
    // mais curto) e a biblioteca a rejeita. Cair no ajuste completo mantém o
    // gráfico utilizável em vez de em branco.
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
      // Arrastar dispara continuamente; só a posição de repouso vale gravar.
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
    mode,
    visiblePositions,
    visibleRolling,
    returnSeries,
    dayTrades,
    showTrades,
    showQuantity,
    showAveragePrice,
    activeBenchmark,
    height,
    currencySymbol,

    theme,
    persistKey,
  ])

  return (
    <AppChartArea
      plotRef={containerRef}
      overlay={
        hoveredTrade && (
          <TradeTooltip
            hovered={hoveredTrade}
            priceFormatter={priceFormatter}
            containerWidth={containerRef.current?.clientWidth ?? 0}
          />
        )
      }
      toolbar={
        <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
          <AppStack direction="row" gap="md" align="center" wrap>
            <AppToggleGroup label="O que o gráfico mostra" options={modes} value={mode} onChange={setMode} />

            <AppDivider orientation="vertical" />

            <ToolbarSwitch label="Trades" checked={showTrades} onChange={setShowTrades} />
            {mode === 'preco' && (
              <>
                <ToolbarSwitch label="Quantidade" checked={showQuantity} onChange={setShowQuantity} />
                <ToolbarSwitch
                  label="Preço médio"
                  checked={showAveragePrice}
                  onChange={setShowAveragePrice}
                />
              </>
            )}
            {/* Lido como frase — "vs CDI" — em vez de como campo de formulário: a
                caixa e o sublinhado de um Select pesavam mais que o gráfico. */}
            {mode === 'rentabilidade' && benchmarkNames.length > 0 && (
              <AppStack direction="row" gap="xs" align="center">
                <AppText variant="bodySmall" tone="secondary">
                  vs
                </AppText>
                <AppSelect
                  size="auto"
                  variant="inline"
                  options={benchmarkNames.map((name) => ({ value: name, label: name }))}
                  value={activeBenchmark ?? ''}
                  onChange={setBenchmark}
                />
              </AppStack>
            )}

            {/* A leitura do que está desenhado, no mesmo lugar nos dois modos.
                O retorno do período abre a frase em ambos — no modo Preço é o da
                cotação, no de Rentabilidade é o da posição — e o resto muda com o
                que cada modo tem a acrescentar. */}
            {mode === 'anualizado' && (
              <AppText variant="bodySmall" tone="secondary">
                Janela móvel de {ROLLING_WINDOW_MONTHS} meses
                {visibleRolling.length > 0 && (
                  <>
                    {' · hoje '}
                    <SignedPercent value={visibleRolling.at(-1)!.value / 100} />
                  </>
                )}
              </AppText>
            )}

            {performance && (
              <AppText variant="bodySmall" tone="secondary">
                Período ({formatSpan(performance.days)}){' '}
                <SignedPercent value={performance.totalReturn} />
                {performance.cagr != null && (
                  <>
                    {' · CAGR '}
                    <SignedPercent value={performance.cagr} />
                  </>
                )}
              </AppText>
            )}

            {returnSeries?.start && (
              <AppText variant="bodySmall" tone="secondary">
                {returnSeries.totalReturn != null && (
                  <>
                    Período ({formatSpan(returnSeries.days)}){' '}
                    <SignedPercent value={returnSeries.totalReturn} />
                    {' · '}
                  </>
                )}
                {returnSeries.excess != null && activeBenchmark && (
                  <>
                    <AppText
                      variant="bodySmall"
                      weight="strong"
                      tone={returnSeries.excess >= 0 ? 'success' : 'danger'}
                      inline
                    >
                      {Math.abs(returnSeries.excess).toFixed(2).replace('.', ',')}%
                    </AppText>
                    {returnSeries.excess >= 0 ? ' acima do ' : ' abaixo do '}
                    {activeBenchmark}
                    {' · '}
                  </>
                )}
                desde {formatMonth(returnSeries.start)}
              </AppText>
            )}
          </AppStack>

          <DateRangeMenu show range={range} options={rangeOptions} onChange={setRange} />
        </AppStack>
      }
    />
  )
}

/** O que a operação foi, em cifras exatas — o marcador só cabe a ordem de
 *  grandeza. */
function TradeTooltip({
  hovered,
  priceFormatter,
  containerWidth,
}: {
  hovered: HoveredTrade
  priceFormatter: (value: number) => string
  containerWidth: number
}) {
  const { trade, x, y } = hovered
  const isBuy = trade.quantity > 0
  const width = 190

  // Vira para o outro lado do cursor perto da borda direita, senão o balão
  // sairia da área do gráfico.
  const left = x + width + 16 > containerWidth ? x - width - 12 : x + 12

  return (
    <AppFloatingCard left={left} top={Math.max(y - 8, 0)} width={width}>
      <AppText variant="caption" tone="secondary">
        {formatDate(trade.time)}
      </AppText>
      <AppText variant="bodySmall" weight="strong" tone={isBuy ? 'success' : 'danger'}>
        {isBuy ? 'Compra' : 'Venda'} de {priceFormatter(trade.value)}
      </AppText>
      <AppText variant="bodySmall" tone="secondary">
        {Math.abs(trade.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} a{' '}
        {priceFormatter(trade.price)}
      </AppText>
    </AppFloatingCard>
  )
}

/** Uma razão (0,12) como percentual com sinal, na cor do sinal. */
function SignedPercent({ value }: { value: number }) {
  const percent = value * 100

  return (
    <AppText
      variant="bodySmall"
      weight="strong"
      tone={percent >= 0 ? 'success' : 'danger'}
      inline
    >
      {percent >= 0 ? '+' : ''}
      {percent.toFixed(2).replace('.', ',')}%
    </AppText>
  )
}
