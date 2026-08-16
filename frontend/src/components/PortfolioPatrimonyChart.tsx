import { defaultRangeOptionsFromOldest } from '@/components/charts/app-bar-chart/helpers'
import { filterFrom } from '@/components/charts/candle/helpers'
import {
    isValidView,
    readChartState,
    writeChartState,
    type PersistedView,
} from '@/components/charts/candle/persistence'
import DateRangeMenu from '@/components/charts/shared/DateRangeMenu'
import ToolbarSwitch from '@/components/charts/shared/ToolbarSwitch'
import { baseChartOptions } from '@/components/portfolio-asset/chart'
import { formatMoneyAxis, moneyMinMove } from '@/components/portfolio-asset/helpers'
import {
    AppNumberField,
    AppSelect,
    AppStack,
    useAppTheme,
    type AppSelectOption,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { getDateFromRange, toISODate, type DateRangeKey } from '@/lib/utils/date'
import { PatrimonyEntry } from '@/types'
import dayjs from 'dayjs'
import {
    LineSeries,
    LineStyle,
    createChart,
    type LineData,
    type Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  patrimonyEvolution: PatrimonyEntry[]
  /** Chave da série: `portfolio` ou o nome de uma categoria do usuário. */
  selected: string
  onSelectedChange: (selected: string) => void
  /** O que o seletor de categoria oferece. */
  categoryOptions: AppSelectOption[]
  /** Taxa que a projeção assume enquanto o usuário não digitar outra, em
   *  percentual ao ano. Nulo quando ainda não dá para saber. */
  defaultRate?: number | null
  /** Aporte mensal que a projeção assume enquanto o usuário não digitar
   *  outro. Nulo quando ainda não dá para saber. */
  defaultContribution?: number | null
  height?: number
  /** Guarda período e janela visível. Sem chave, o gráfico não lembra nada. */
  persistKey?: string
}

/** Ponto de uma das curvas, no formato que a biblioteca consome. */
type Point = { time: string; value: number }

const DAYS_IN_YEAR = 365
const DAYS_IN_MONTH = 30

/** Quanto a carteira vale, dia a dia, com o aportado e o que rendeu por cima.
 *
 *  Três linhas, sem preenchimento. A área embaixo do patrimônio parecia a
 *  escolha óbvia — é uma grandeza acumulada —, mas a cor primária dos temas
 *  claros é quase preta, e qualquer alfa sobre ela vira uma mancha cinza que
 *  cobre as outras duas curvas em vez de dar volume a esta.
 *
 *  A projeção sai nas mesmas cores, tracejada. Ela é uma continuação da curva,
 *  não outra curva — o tracejado é o que diz que dali para frente é conta, e
 *  não histórico. */
export default function PortfolioPatrimonyChart({
  patrimonyEvolution,
  selected,
  onSelectedChange,
  categoryOptions,
  defaultRate,
  defaultContribution,
  height = 520,
  persistKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useAppTheme()
  const { symbol: currencySymbol } = useCurrency()

  const restored = useRef(readChartState(persistKey)).current
  const [range, setRange] = useState<DateRangeKey>(restored.range ?? 'max')
  const [showProjection, setShowProjection] = useState(false)
  const [projectionYears, setProjectionYears] = useState(1)

  /* Taxa e aporte começam no que a carteira vem fazendo — o CAGR dela e o
   *  aporte médio — em vez de num número redondo inventado. Assim a projeção
   *  responde "se continuar assim" antes de qualquer digitação.
   *
   *  Os dois valores chegam depois dos dados, e a carteira ainda troca de
   *  categoria, então o campo precisa acompanhar. Mas só até o usuário
   *  digitar: a partir daí o número é dele, e sobrescrevê-lo apagaria o que
   *  ele acabou de simular. Daí o par estado + `useRef` de tocado, e não um
   *  `defaultValue` puro. */
  const [projectionRate, setProjectionRate] = useState(defaultRate ?? 10)
  const [monthlyContribution, setMonthlyContribution] = useState(defaultContribution ?? 0)
  const rateTouched = useRef(false)
  const contributionTouched = useRef(false)

  useEffect(() => {
    if (rateTouched.current || defaultRate == null) return
    setProjectionRate(defaultRate)
  }, [defaultRate])

  useEffect(() => {
    if (contributionTouched.current || defaultContribution == null) return
    setMonthlyContribution(defaultContribution)
  }, [defaultContribution])

  const viewRef = useRef<PersistedView | null>(isValidView(restored.view) ? restored.view : null)

  useEffect(() => {
    writeChartState(persistKey, { range })
  }, [persistKey, range])

  /* Descarta a janela guardada quando o que a série cobre muda.
   *
   *  Ligar a projeção acrescenta anos à direita, e a janela restaurada
   *  continuava mostrando só o histórico — a projeção existia mas ficava fora
   *  da tela, e só aparecia arrastando. Trocar o período tem o mesmo efeito
   *  pelo outro lado. Nos dois casos o certo é reenquadrar; a taxa e o aporte
   *  ficam de fora porque mexem na altura da curva, não na extensão dela, e a
   *  escala de preço já se ajusta sozinha. */
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    viewRef.current = null
    writeChartState(persistKey, { view: null })
  }, [range, showProjection, projectionYears, persistKey])

  /* Aportado e crescimento só existem para a carteira inteira: `acc_aported`
     é um total da carteira, e recortá-lo por categoria diria que aquela
     categoria recebeu todo o dinheiro. */
  const showBreakdown = selected === 'portfolio'

  /* Uma data pode aparecer duas vezes na série que vem da API, e a biblioteca
     rejeita o dia repetido — a última leitura do dia é a que vale. */
  const series = useMemo(() => {
    const value = new Map<string, number>()
    const aported = new Map<string, number>()

    for (const entry of patrimonyEvolution) {
      const raw = entry[selected]
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
      const time = toISODate(entry.date)
      value.set(time, raw)

      const contributed = entry.acc_aported
      if (typeof contributed === 'number' && Number.isFinite(contributed)) {
        aported.set(time, contributed)
      }
    }

    const sorted = (map: Map<string, number>): Point[] =>
      [...map.entries()]
        .map(([time, value]) => ({ time, value }))
        .sort((a, b) => a.time.localeCompare(b.time))

    const valuePoints = sorted(value)
    const aportedPoints = showBreakdown ? sorted(aported) : []

    /* O crescimento é o que sobra do patrimônio depois de tirar o que entrou
       de fora, e só existe nos dias em que as duas séries existem. */
    const growthPoints: Point[] = showBreakdown
      ? valuePoints
          .filter((point) => aported.has(point.time))
          .map((point) => ({
            time: point.time,
            value: Math.max(0, point.value - aported.get(point.time)!),
          }))
      : []

    return { valuePoints, aportedPoints, growthPoints }
  }, [patrimonyEvolution, selected, showBreakdown])

  const rangeOptions = useMemo(
    () => defaultRangeOptionsFromOldest(series.valuePoints[0]?.time ?? null),
    [series.valuePoints],
  )

  const fromISO = useMemo(
    () => (range === 'max' ? null : getDateFromRange(range).format('YYYY-MM-DD')),
    [range],
  )

  const visible = useMemo(
    () => ({
      valuePoints: filterFrom(series.valuePoints, fromISO),
      aportedPoints: filterFrom(series.aportedPoints, fromISO),
      growthPoints: filterFrom(series.growthPoints, fromISO),
    }),
    [series, fromISO],
  )

  /* Juro composto diário sobre o último patrimônio, com o aporte entrando de
     30 em 30 dias. A projeção parte do último ponto histórico para as curvas
     se encontrarem ali, sem degrau entre o cheio e o tracejado. */
  const projected = useMemo(() => {
    const last = visible.valuePoints.at(-1)
    if (!showProjection || !last) {
      return { valuePoints: [] as Point[], aportedPoints: [] as Point[], growthPoints: [] as Point[] }
    }

    const lastAported = visible.aportedPoints.at(-1)?.value ?? 0
    const dailyRate = Math.pow(1 + projectionRate / 100, 1 / DAYS_IN_YEAR)
    const days = DAYS_IN_YEAR * projectionYears
    const start = dayjs(last.time)

    let principal = last.value
    let contributed = 0

    const valuePoints: Point[] = [last]
    const aportedPoints: Point[] = showBreakdown ? [{ time: last.time, value: lastAported }] : []
    const growthPoints: Point[] = showBreakdown
      ? [{ time: last.time, value: Math.max(0, last.value - lastAported) }]
      : []

    for (let day = 1; day <= days; day++) {
      principal *= dailyRate
      if (monthlyContribution > 0 && day % DAYS_IN_MONTH === 0) contributed += monthlyContribution

      const time = start.add(day, 'day').format('YYYY-MM-DD')
      const value = principal + contributed
      valuePoints.push({ time, value })

      if (showBreakdown) {
        const aported = lastAported + contributed
        aportedPoints.push({ time, value: aported })
        growthPoints.push({ time, value: Math.max(0, value - aported) })
      }
    }

    return { valuePoints, aportedPoints, growthPoints }
  }, [
    showProjection,
    visible,
    projectionRate,
    projectionYears,
    monthlyContribution,
    showBreakdown,
  ])

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, baseChartOptions(theme, height))

    /* O eixo é formatado pelo maior valor à vista, incluindo a projeção: sem
       isso os rótulos trocariam de casa decimal ao ligar a projeção. */
    const maxValue = [
      ...visible.valuePoints,
      ...visible.aportedPoints,
      ...projected.valuePoints,
    ].reduce((max, point) => Math.max(max, point.value), 0)

    const priceFormat = {
      type: 'custom' as const,
      formatter: (value: number) => formatMoneyAxis(value, currencySymbol, maxValue),
      minMove: moneyMinMove(maxValue),
    }

    const valueColor = theme.palette.primary.main
    const aportedColor = theme.palette.secondary.main
    const growthColor = theme.palette.success.main

    const addLine = (points: Point[], color: string, title: string, dashed = false) => {
      if (points.length === 0) return
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
        title,
        priceFormat,
        /* O tracejado da projeção não entra na legenda de preço nem puxa o
           último valor: quem manda no rótulo é a curva histórica. */
        lastValueVisible: !dashed,
        crosshairMarkerVisible: !dashed,
      })
      line.setData(points as LineData<Time>[])
    }

    addLine(visible.valuePoints, valueColor, 'Patrimônio')
    addLine(visible.aportedPoints, aportedColor, 'Aportado')
    addLine(visible.growthPoints, growthColor, 'Crescimento')

    addLine(projected.valuePoints, valueColor, 'Projeção', true)
    addLine(projected.aportedPoints, aportedColor, 'Aportes projetados', true)
    addLine(projected.growthPoints, growthColor, 'Crescimento projetado', true)

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

    let writeTimer: ReturnType<typeof setTimeout> | undefined
    const onVisibleRangeChange = (window: unknown) => {
      if (!isValidView(window)) return
      viewRef.current = window
      clearTimeout(writeTimer)
      writeTimer = setTimeout(() => writeChartState(persistKey, { view: window }), 300)
    }
    timeScale.subscribeVisibleTimeRangeChange(onVisibleRangeChange)

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      clearTimeout(writeTimer)
      timeScale.unsubscribeVisibleTimeRangeChange(onVisibleRangeChange)
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [visible, projected, height, currencySymbol, theme, persistKey])

  return (
    <AppStack gap="md">
      {/* A barra mora dentro do gráfico, como na tela de rentabilidade: o que
          se escolhe aqui só faz sentido olhando para a curva. */}
      <AppStack direction="row" gap="md" align="center" justify="between" wrap>
        <AppStack direction="row" gap="md" align="center" wrap>
          <AppSelect options={categoryOptions} value={selected} onChange={onSelectedChange} />
          <ToolbarSwitch label="Projeção" checked={showProjection} onChange={setShowProjection} />
          {showProjection && (
            <AppStack direction="row" gap="sm" align="center" wrap>
              <AppNumberField
                label="Taxa a.a."
                value={projectionRate}
                onChange={(value) => {
                  rateTouched.current = true
                  setProjectionRate(value)
                }}
                step={0.1}
                suffix="%"
                size="sm"
              />
              <AppNumberField
                label="Anos"
                value={projectionYears}
                onChange={setProjectionYears}
                min={1}
                size="xs"
              />
              <AppNumberField
                label="Aporte mensal"
                value={monthlyContribution}
                onChange={(value) => {
                  contributionTouched.current = true
                  setMonthlyContribution(value)
                }}
                step={100}
                prefix={currencySymbol}
                size="md"
              />
            </AppStack>
          )}
        </AppStack>

        <DateRangeMenu show range={range} options={rangeOptions} onChange={setRange} />
      </AppStack>

      <div ref={containerRef} />
    </AppStack>
  )
}
