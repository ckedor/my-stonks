import type { LevelReading } from '@/api/market'
import {
  AppCard,
  AppLink,
  AppMetric,
  AppMetricRow,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
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

/** O mercado em destaque, grande: a trajetória na janela com a média de 40
 *  semanas, e os três números que a resumem. Qual mercado é escolha da aba —
 *  por padrão o mundo inteiro. */
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
  const points = pointsInWindow(reading.history, window)
  const change = windowChange(points)
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
          points={points}
          height={chartHeight}
          format={(value) => formatLevel(reading, value)}
          valueLabel={title}
          showMovingAverage
          axes
          label={`${title}: ${signedPercent(change)} ${WINDOW_LABEL[window].toLowerCase()}`}
        />
        <AppText variant="caption" tone="secondary">
          A linha tracejada é a média de 40 semanas.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
