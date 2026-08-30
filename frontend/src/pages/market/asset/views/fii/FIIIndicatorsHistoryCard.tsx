import type { FIIIndicators } from '@/api/market'
import { AppCard, AppStack, AppText, SectionTitle } from '@/components/ui'
import PublishedSeriesChart, { type PublishedSeriesMetric } from '../PublishedSeriesChart'
import {
  formatBRL,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatMultiple,
  formatPercent,
} from '../format'

/** The same indicators the card above shows, month by month.
 *
 *  P/VP first: it is the one a reader comes to the history for — the current
 *  number says the share trades above or below what the fund says it is worth,
 *  and only the series says whether that is where it usually trades.
 */
const METRICS: PublishedSeriesMetric<FIIIndicators>[] = [
  { key: 'price_to_nav', label: 'P/VP', read: (m) => m.price_to_nav, format: formatMultiple },
  {
    key: 'dividend_yield_12m',
    label: 'DY 12 meses',
    read: (m) => m.dividend_yield_12m,
    format: formatPercent,
  },
  {
    key: 'dividend_yield_1m',
    label: 'DY no mês',
    read: (m) => m.dividend_yield_1m,
    format: formatPercent,
  },
  {
    key: 'monthly_return',
    label: 'Retorno no mês',
    read: (m) => m.monthly_return,
    format: formatPercent,
  },
  { key: 'price', label: 'Cota', read: (m) => m.price, format: formatBRL },
  {
    key: 'nav_per_share',
    label: 'Valor patrimonial',
    read: (m) => m.nav_per_share,
    format: formatBRL,
  },
  { key: 'equity', label: 'Patrimônio líquido', read: (m) => m.equity, format: formatCompactBRL },
  {
    key: 'total_assets',
    label: 'Ativos totais',
    read: (m) => m.total_assets,
    format: formatCompactBRL,
  },
  {
    key: 'shares_outstanding',
    label: 'Cotas emitidas',
    read: (m) => m.shares_outstanding,
    format: formatCompactCount,
  },
  {
    key: 'shareholders',
    label: 'Cotistas',
    read: (m) => m.shareholders,
    format: formatCompactCount,
  },
]

const monthOf = (indicators: FIIIndicators) => indicators.as_of_date

/** Where the fund's own numbers have been.
 *
 *  One point a month, because that is how often a fund republishes them: this
 *  is a series of reports, not of prices, and the price chart above is the one
 *  that moves daily.
 */
export default function FIIIndicatorsHistoryCard({ history }: { history: FIIIndicators[] }) {
  const first = history[0]
  const last = history.at(-1)

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Histórico de indicadores</SectionTitle>
          {first?.as_of_date && last?.as_of_date && (
            <AppText variant="bodySmall" tone="secondary">
              De {formatDate(first.as_of_date)} a {formatDate(last.as_of_date)}
            </AppText>
          )}
        </AppStack>

        <PublishedSeriesChart
          points={history}
          dateOf={monthOf}
          metrics={METRICS}
          label="Indicador"
          emptyMessage="O provedor não retornou histórico de indicadores para este fundo."
        />
      </AppStack>
    </AppCard>
  )
}
