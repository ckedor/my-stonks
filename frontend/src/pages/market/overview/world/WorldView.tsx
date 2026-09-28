import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LevelReading, RateReading, WorldMarketReadings } from '@/api/market'
import {
  AppAlert,
  AppCard,
  AppChartArea,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppSelect,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import { formatDate } from '@/lib/utils/format'
import { useWorldMarketReadings } from '@/queries/market'
import ReadingChart from './ReadingChart'
import Thermometer from './Thermometer'
import FeaturedMarket, { FEATURED_CHART_HEIGHT } from './FeaturedMarket'
import ReferenceQuotes from './ReferenceQuotes'
import { LevelCard } from './WorldPieces'
import WorldSkeleton from './WorldSkeleton'
import {
  CHART_WINDOWS,
  changeTone,
  copyOf,
  formatLevel,
  percentileLabel,
  ratePerYear,
  signedPercent,
  type ChartWindow,
} from './readings'

/* O mundo inteiro é o destaque fixo da aba; os recortes dele são os cards da
   seção de baixo, na ordem desta lista. */
const WORLD = 'msci_acwi'
const INDEXES = ['msci_world', 'msci_usa', 'msci_acwi_ex_usa', 'msci_em', 'ibovespa_usd'] as const

type ReturnPeriod = 'ytd' | '1y' | '5y' | '10y'

const RETURN_PERIODS: { value: ReturnPeriod; label: string }[] = [
  { value: 'ytd', label: 'No ano' },
  { value: '1y', label: '12 meses' },
  { value: '5y', label: '5 anos, ao ano' },
  { value: '10y', label: '10 anos, ao ano' },
]

const RETURN_OF: Record<ReturnPeriod, (reading: LevelReading) => number | null> = {
  ytd: (reading) => reading.year_to_date_return,
  '1y': (reading) => reading.one_year_return,
  '5y': (reading) => reading.five_year_annualized_return,
  '10y': (reading) => reading.ten_year_annualized_return,
}

/** A aba Mundo: câmbio, cripto, juro e as bolsas do mundo, medidos contra a
 *  própria história. Tudo o que ela afirma é aritmética sobre série
 *  guardada — nenhum texto gerado, nenhuma projeção. */
export default function WorldView() {
  const { readings, loading, failed } = useWorldMarketReadings()
  if (loading) return <WorldSkeleton />
  if (failed || !readings) {
    return <AppAlert severity="error">Não foi possível carregar as leituras de mercado.</AppAlert>
  }
  return <WorldReadings readings={readings} />
}

function WorldReadings({ readings }: { readings: WorldMarketReadings }) {
  const [window, setWindow] = useState<ChartWindow>('1y')
  const levels = useMemo(
    () => new Map(readings.levels.map((reading) => [reading.key, reading])),
    [readings.levels]
  )
  const rates = useMemo(
    () => new Map(readings.rates.map((reading) => [reading.key, reading])),
    [readings.rates]
  )
  const indexes = INDEXES.flatMap((key) => levels.get(key) ?? [])
  const world = levels.get(WORLD)
  const featured = useFeaturedChartHeight()
  const ranked = world ? [world, ...indexes] : indexes
  const usdBrl = levels.get('usd_brl')
  const bitcoin = levels.get('btc')
  const gold = levels.get('gold')
  /* Bitcoin e ouro entram no ranking: também são preço em dólar, e é contra
     eles que a bolsa costuma ser comparada. O dólar não — ele é a régua. */
  const inDollars = [...ranked, ...[bitcoin, gold].flatMap((reading) => reading ?? [])]
  const cdi = rates.get('cdi')
  const realInterest = rates.get('real_interest')
  const asOf = readings.levels
    .map((reading) => reading.as_of)
    .sort()
    .at(-1)

  return (
    <AppStack gap="xl">
      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="end" gap="md" wrap>
          <AppStack gap="xs">
            <SectionLabel>EM DESTAQUE</SectionLabel>
            <SectionTitle>O mundo, as cotações de referência e quem lidera</SectionTitle>
            {asOf && (
              <AppText variant="caption" tone="secondary">
                Último fechamento em {formatDate(asOf)}
              </AppText>
            )}
          </AppStack>
          <AppSelect
            label="Janela dos gráficos"
            size="sm"
            value={window}
            options={CHART_WINDOWS}
            onChange={(value) => setWindow(value as ChartWindow)}
          />
        </AppStack>
        <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="start">
          <AppGridItem span={{ xs: 1, lg: 7 }} ref={featured.featuredRef}>
            {world && (
              <FeaturedMarket reading={world} window={window} chartHeight={featured.chartHeight} />
            )}
          </AppGridItem>
          <AppGridItem span={{ xs: 1, lg: 5 }} ref={featured.sideRef}>
            <AppStack gap="md">
              <ReferenceQuotes usdBrl={usdBrl} bitcoin={bitcoin} gold={gold} cdi={cdi} />
              <ReturnRanking readings={inDollars} />
            </AppStack>
          </AppGridItem>
        </AppGrid>
      </AppStack>

      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>AS BOLSAS DO MUNDO</SectionLabel>
          <SectionTitle>Com dividendos reinvestidos, em dólar</SectionTitle>
          <AppText variant="caption" tone="secondary">
            Os recortes do mundo. O Ibovespa entra convertido pelo câmbio de cada semana; ele já é
            um índice de retorno total, como os MSCI.
          </AppText>
        </AppStack>
        <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="md">
          {indexes.map((reading) => (
            <LevelCard key={reading.key} reading={reading} window={window} />
          ))}
        </AppGrid>
      </AppStack>

      <Thermometer
        readings={[
          ...inDollars,
          ...[usdBrl].flatMap((reading) => reading ?? []),
          ...readings.comparisons,
        ]}
      />

      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>QUEM LIDERA</SectionLabel>
          <SectionTitle>Um mercado contra o outro</SectionTitle>
          <AppText variant="bodySmall" tone="secondary">
            A razão entre dois índices, base 100 no primeiro dia comum. Subindo, o primeiro ganha do
            segundo; a linha tracejada é a média de 40 semanas.
          </AppText>
        </AppStack>
        <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
          {readings.comparisons.map((reading) => (
            <ComparisonCard key={reading.key} reading={reading} />
          ))}
        </AppGrid>
      </AppStack>

      {realInterest && cdi && <InterestCard cdi={cdi} realInterest={realInterest} />}

      <AppText variant="caption" tone="secondary">
        Leituras semanais sobre o histórico guardado: o último fechamento de cada semana. Os índices
        MSCI são de retorno líquido (dividendos reinvestidos após impostos), em dólar, desde
        dezembro de 2000; o dólar é lido desde o Plano Real. Percentil é a fração do próprio
        histórico que ficou abaixo do valor de hoje — diz onde o número está, não se ele está caro.
      </AppText>
    </AppStack>
  )
}

/** A altura do gráfico em destaque que faz o card dele terminar na mesma
 *  linha que a coluna das cotações e do ranking — só com as duas lado a lado;
 *  empilhadas, no celular, ele fica na altura padrão.
 *
 *  Em pixels, e medida: o que o card ocupa além do gráfico (título, métricas,
 *  legenda) é a altura dele menos a do gráfico, e o gráfico recebe o que
 *  falta para empatar. Esticar pelo grid com altura percentual não serve — o
 *  gráfico mede o card para se desenhar, o card cresce com ele, e o laço não
 *  para. */
function useFeaturedChartHeight() {
  const featuredRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(FEATURED_CHART_HEIGHT)
  const current = useRef(chartHeight)
  current.current = chartHeight

  useLayoutEffect(() => {
    const side = sideRef.current
    const featured = featuredRef.current
    if (!side || !featured) return
    const measure = () => {
      const sideBySide = Math.abs(side.offsetTop - featured.offsetTop) < 1
      const chrome = featured.offsetHeight - current.current
      const next = sideBySide
        ? Math.max(FEATURED_CHART_HEIGHT, side.offsetHeight - chrome)
        : FEATURED_CHART_HEIGHT
      if (Math.abs(next - current.current) > 1) setChartHeight(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(side)
    observer.observe(featured)
    return () => observer.disconnect()
  }, [])

  return { featuredRef, sideRef, chartHeight }
}

function ReturnRanking({ readings }: { readings: LevelReading[] }) {
  const theme = useAppTheme()
  const [period, setPeriod] = useState<ReturnPeriod>('1y')
  const ranked = readings
    .map((reading) => ({ name: copyOf(reading.key).title, value: RETURN_OF[period](reading) }))
    .filter((row): row is { name: string; value: number } => row.value != null)
    .sort((a, b) => b.value - a.value)
  return (
    <AppCard padding="lg">
      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
          <SectionLabel>RETORNO EM DÓLAR</SectionLabel>
          <AppSelect
            label="Período"
            size="sm"
            value={period}
            options={RETURN_PERIODS}
            onChange={(value) => setPeriod(value as ReturnPeriod)}
          />
        </AppStack>
        {ranked.length > 0 && (
          <AppText variant="bodySmall" tone="secondary">
            {ranked[0].name} lidera; {ranked[ranked.length - 1].name} fica na outra ponta.
          </AppText>
        )}
        <AppChartArea height={Math.max(180, ranked.length * 36)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ranked}
              layout="vertical"
              margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={(value: number) => signedPercent(value)}
                tick={{ fill: theme.palette.chart.label, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={105}
                tick={{ fill: theme.palette.chart.label, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke={theme.palette.divider} />
              <Tooltip formatter={(value) => [signedPercent(Number(value)), 'Retorno']} />
              <Bar dataKey="value" barSize={12} radius={3} isAnimationActive={false}>
                {ranked.map((row) => (
                  <Cell
                    key={row.name}
                    fill={row.value < 0 ? theme.palette.error.main : theme.palette.success.main}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AppChartArea>
      </AppStack>
    </AppCard>
  )
}

function ComparisonCard({ reading }: { reading: LevelReading }) {
  const { title, label } = copyOf(reading.key)
  return (
    <AppCard padding="lg">
      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionTitle>{title}</SectionTitle>
          <AppText variant="caption" tone="secondary">
            {label}
          </AppText>
        </AppStack>
        <AppGrid cols={{ xs: 3 }} gap="sm">
          <AppMetric
            label="12 meses"
            value={signedPercent(reading.one_year_return)}
            tone={changeTone(reading.one_year_return)}
          />
          <AppMetric
            label="10 anos, ao ano"
            value={signedPercent(reading.ten_year_annualized_return)}
            tone={changeTone(reading.ten_year_annualized_return)}
          />
          <AppMetric
            label="Contra a média"
            value={signedPercent(reading.distance_to_moving_average)}
            hint={percentileLabel(reading.distance_percentile)}
          />
        </AppGrid>
        <ReadingChart
          points={reading.history}
          height={280}
          format={(value) => formatLevel(reading, value)}
          valueLabel="Razão, base 100"
          showMovingAverage
          reference={100}
          axes
          label={`${title}: razão entre os índices desde ${reading.since.slice(0, 4)}`}
        />
      </AppStack>
    </AppCard>
  )
}

function InterestCard({ cdi, realInterest }: { cdi: RateReading; realInterest: RateReading }) {
  return (
    <AppCard padding="lg">
      <AppGrid cols={{ xs: 1, md: 12 }} gap="lg">
        <AppGridItem span={{ xs: 1, md: 4 }}>
          <AppStack gap="md">
            <SectionLabel>O PREÇO DO DINHEIRO</SectionLabel>
            <SectionTitle>O que o CDI pagou acima da inflação</SectionTitle>
            <AppMetric
              label="Juro real, últimos 12 meses"
              value={ratePerYear(realInterest.value)}
              size="lg"
            />
            <AppMetric label="CDI hoje" value={ratePerYear(cdi.value)} />
            <AppText variant="bodySmall" tone="secondary">
              É a régua que um ativo de risco precisa bater. Hoje ela está no{' '}
              {percentileLabel(realInterest.percentile)} desde {realInterest.since.slice(0, 4)}.
            </AppText>
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, md: 8 }}>
          <ReadingChart
            points={realInterest.history}
            height={280}
            format={(value) => ratePerYear(value)}
            tickFormat={(value) => `${Math.round(value * 100)}%`}
            valueLabel="Juro real"
            reference={0}
            axes
            label={`Juro real desde ${realInterest.since.slice(0, 4)}`}
          />
        </AppGridItem>
      </AppGrid>
    </AppCard>
  )
}
