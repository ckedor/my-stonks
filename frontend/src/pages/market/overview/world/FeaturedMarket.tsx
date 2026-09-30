import { useMemo } from 'react'
import type { LevelReading, MarketDataSeriesHistoryPoint, ReadingPoint } from '@/api/market'
import {
  AppCard,
  AppLink,
  AppMetric,
  AppMetricRow,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { useMarketDataSeriesHistory } from '@/queries/market'
import ReadingChart from './ReadingChart'
import {
  changeTone,
  copyOf,
  formatLevel,
  pointsInWindow,
  readingHref,
  signedPercent,
  windowChange,
  type ChartWindow,
} from './readings'

/** A altura do gráfico quando ninguém pede outra. */
export const FEATURED_CHART_HEIGHT = 260

const WINDOW_LABEL: Record<ChartWindow, string> = {
  '1y': 'Em 1 ano',
  '5y': 'Em 5 anos',
  '10y': 'Em 10 anos',
  max: 'Desde o início',
}

const TICK_PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

/** A rentabilidade acumulada na janela, dia a dia: os fechamentos diários da
 *  série entre a semana-base e o último fechamento, contra o fechamento da
 *  semana-base. A base é a mesma dos números do card, então o fim da linha é
 *  o "em 1 ano" escrito em cima. Sem a série diária — ainda carregando, ou
 *  uma leitura que não é série —, a semanal faz as vezes. */
function returnsInWindow(
  weekly: ReadingPoint[],
  daily: MarketDataSeriesHistoryPoint[]
): ReadingPoint[] {
  if (weekly.length < 2 || weekly[0].value === 0) return []
  const base = weekly[0].value
  const from = weekly[0].date
  const to = weekly[weekly.length - 1].date
  const closes = daily.filter(
    (point): point is MarketDataSeriesHistoryPoint & { close: number } =>
      point.close != null && point.date >= from && point.date <= to
  )
  const points =
    closes.length > weekly.length
      ? closes.map((point) => ({ date: point.date, value: point.close }))
      : weekly
  return points.map((point) => ({
    date: point.date,
    value: point.value / base - 1,
    moving_average: null,
  }))
}

/** O mercado em destaque, grande: a rentabilidade dia a dia na janela e os
 *  números que a resumem. Qual mercado é escolha da aba — por padrão o mundo
 *  inteiro. */
export default function FeaturedMarket({
  reading,
  window,
  chartHeight = FEATURED_CHART_HEIGHT,
}: {
  reading: LevelReading
  window: ChartWindow
  /** Em pixels. A aba passa a que faz o card terminar na linha da coluna
   *  vizinha. */
  chartHeight?: number
}) {
  const { title, label } = copyOf(reading.key)
  const points = useMemo(() => pointsInWindow(reading.history, window), [reading.history, window])
  const change = windowChange(points)
  const { history: daily } = useMarketDataSeriesHistory(reading.series_id ?? Number.NaN)
  const returns = useMemo(() => returnsInWindow(points, daily), [points, daily])
  const href = readingHref(reading)
  const cagr = reading.since_start_annualized_return
  /* Com a janela de um ano, o número grande já é o dos 12 meses — medido
     contra a mesma semana-base. O vizinho passa a dizer o ano corrente. */
  const second =
    window === '1y'
      ? { label: 'No ano', value: reading.year_to_date_return }
      : { label: '12 meses', value: reading.one_year_return }
  return (
    <AppCard padding="lg">
      <AppStack gap="md">
        <AppStack direction="row" justify="between" align="start" gap="sm">
          <AppStack gap="xs">
            <SectionTitle>{title}</SectionTitle>
            <AppText variant="caption" tone="secondary">
              {label}
            </AppText>
          </AppStack>
          {href && <AppLink to={href}>Abrir histórico →</AppLink>}
        </AppStack>
        <AppMetricRow>
          <AppMetric
            label={WINDOW_LABEL[window]}
            value={signedPercent(change)}
            tone={changeTone(change)}
            size="lg"
          />
          <AppMetric
            label={second.label}
            value={signedPercent(second.value)}
            tone={changeTone(second.value)}
          />
          <AppMetric
            label={`CAGR desde ${reading.since.slice(0, 4)}`}
            value={cagr == null ? '—' : `${signedPercent(cagr)} a.a.`}
            tone={changeTone(cagr)}
          />
          <AppMetric label="Hoje" value={formatLevel(reading)} />
        </AppMetricRow>
        <ReadingChart
          points={returns}
          height={chartHeight}
          format={signedPercent}
          tickFormat={(value) => TICK_PERCENT.format(value)}
          valueLabel="Rentabilidade"
          reference={0}
          axes
          label={`${title}: ${signedPercent(change)} ${WINDOW_LABEL[window].toLowerCase()}`}
        />
      </AppStack>
    </AppCard>
  )
}
