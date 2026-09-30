import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import type { LevelReading } from '@/api/market'
import { AppCard, AppMetric, AppStack, AppText, type SpaceToken } from '@/components/ui'
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

const CARD_CHART_HEIGHT = 120

const WINDOW_LABEL: Record<ChartWindow, string> = {
  '1y': 'em 1 ano',
  '5y': 'em 5 anos',
  '10y': 'em 10 anos',
  max: 'desde o início',
}

/** Um card que leva à tela do que ele lê, quando há uma. */
export function ReadingCard({
  href,
  title,
  padding,
  children,
}: {
  href: string | null
  title: string
  padding?: SpaceToken
  children: ReactNode
}) {
  const navigate = useNavigate()
  if (href == null) return <AppCard padding={padding}>{children}</AppCard>
  const open = () => navigate(href)
  return (
    <AppCard
      padding={padding}
      interactive
      role="link"
      tabIndex={0}
      aria-label={`Abrir ${title}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
    >
      {children}
    </AppCard>
  )
}

/** Um mercado: quanto andou na janela, que é o número que se lê primeiro; o
 *  crescimento anual desde o começo da série; e, discreto, o nível — pontos
 *  de índice dizem pouco sozinhos. */
export function LevelCard({ reading, window }: { reading: LevelReading; window: ChartWindow }) {
  const { title, label } = copyOf(reading.key)
  const points = pointsInWindow(reading.history, window)
  const change = windowChange(points)
  const cagr = reading.since_start_annualized_return
  const href = readingHref(reading)
  return (
    <ReadingCard href={href} title={title}>
      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="start" gap="sm">
          <AppMetric
            label={`${title} · ${WINDOW_LABEL[window]}`}
            value={signedPercent(change)}
            tone={changeTone(change)}
            size="lg"
          />
          {href != null && <ArrowForwardRoundedIcon fontSize="small" />}
        </AppStack>
        <ReadingChart
          points={points}
          height={CARD_CHART_HEIGHT}
          format={(value) => formatLevel(reading, value)}
          valueLabel={title}
          showMovingAverage
          label={`${title}: ${signedPercent(change)} ${WINDOW_LABEL[window]}`}
        />
        <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
          <AppText variant="bodySmall" weight="strong" tone={changeTone(cagr)}>
            {cagr == null ? 'CAGR —' : `CAGR ${signedPercent(cagr)} a.a.`}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {formatLevel(reading)}
            {reading.key === 'ibovespa_usd'
              ? ' pts em US$'
              : reading.series_id != null
                ? ' pts'
                : ''}
          </AppText>
        </AppStack>
        <AppText variant="caption" tone="secondary">
          {label} · CAGR desde {reading.since.slice(0, 4)}
        </AppText>
      </AppStack>
    </ReadingCard>
  )
}
