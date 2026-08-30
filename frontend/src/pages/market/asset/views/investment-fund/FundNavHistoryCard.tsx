import type { InvestmentFundNavPoint } from '@/api/market'
import { AppCard, AppSelect, AppStack, AppText, SectionTitle } from '@/components/ui'
import { useMemo, useState } from 'react'
import { formatBRL, formatCompactBRL, formatCompactCount, formatDate, formatPercent } from '../format'
import PublishedSeriesChart, { type PublishedSeriesMetric } from '../PublishedSeriesChart'

/** As séries que o arquivamento do valor da cota carrega.
 *
 *  O valor da cota primeiro: é o que o leitor vem procurar aqui. O preço de
 *  mercado está no gráfico acima e é outra coisa — uma cota que não negocia há
 *  uma semana continua tendo valor patrimonial arquivado todo dia.
 */
const METRICS: PublishedSeriesMetric<InvestmentFundNavPoint>[] = [
  { key: 'nav_per_share', label: 'Valor da cota', read: (p) => p.nav_per_share, format: formatBRL },
  { key: 'equity', label: 'Patrimônio líquido', read: (p) => p.equity, format: formatCompactBRL },
  {
    key: 'total_assets',
    label: 'Ativos totais',
    read: (p) => p.total_assets,
    format: formatCompactBRL,
  },
  {
    key: 'shareholders',
    label: 'Cotistas',
    read: (p) => p.shareholders,
    format: formatCompactCount,
  },
  {
    key: 'daily_applications',
    label: 'Aplicações no dia',
    read: (p) => p.daily_applications,
    format: formatCompactBRL,
  },
  {
    key: 'daily_redemptions',
    label: 'Resgates no dia',
    read: (p) => p.daily_redemptions,
    format: formatCompactBRL,
  },
  {
    key: 'monthly_return',
    label: 'Retorno no mês',
    read: (p) => p.monthly_return,
    format: formatPercent,
  },
]

const dateOf = (point: InvestmentFundNavPoint) => point.date

/** Todas as classes, quando o fundo não arquiva por classe nenhuma. */
const SINGLE_CLASS = 'all'

/** Quantos arquivamentos bastam para o eixo do tempo virar diário.
 *
 *  Um FI arquiva todo dia útil e um FIDC uma vez por mês; com dois anos de
 *  série, o mensal cabe em vinte e quatro pontos e o diário em quinhentos. É a
 *  densidade que decide como a marca do eixo se escreve, e não o tipo do fundo:
 *  o mesmo tipo pode ter arquivado de um jeito antes e de outro depois. */
const DAILY_THRESHOLD = 60

/** Onde o valor da cota esteve.
 *
 *  Um FIDC arquiva por classe ou série, e as classes de um mesmo fundo valem
 *  coisas diferentes: uma sênior a R$ 120 e uma subordinada a R$ 80 desenhadas
 *  na mesma linha viram um serrote que não é a variação de nenhuma das duas. Por
 *  isso a classe é escolhida antes da métrica, e só aparece quando há mais de
 *  uma para escolher.
 */
export default function FundNavHistoryCard({ history }: { history: InvestmentFundNavPoint[] }) {
  const classes = useMemo(
    () => [...new Set(history.map((point) => point.class_or_series).filter(Boolean) as string[])],
    [history]
  )

  const [selectedClass, setSelectedClass] = useState(SINGLE_CLASS)
  const current = classes.includes(selectedClass) ? selectedClass : (classes[0] ?? SINGLE_CLASS)

  const points = useMemo(
    () =>
      current === SINGLE_CLASS
        ? history
        : history.filter((point) => point.class_or_series === current),
    [history, current]
  )

  const first = points[0]
  const last = points.at(-1)

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Valor da cota arquivado</SectionTitle>
          {first && last && (
            <AppText variant="bodySmall" tone="secondary">
              De {formatDate(first.date)} a {formatDate(last.date)}
            </AppText>
          )}
        </AppStack>

        {classes.length > 1 && (
          <AppSelect
            label="Classe ou série"
            value={current}
            onChange={setSelectedClass}
            size="md"
            options={classes.map((item) => ({ value: item, label: item }))}
          />
        )}

        <PublishedSeriesChart
          points={points}
          dateOf={dateOf}
          metrics={METRICS}
          label="Série"
          granularity={points.length > DAILY_THRESHOLD ? 'day' : 'month'}
          emptyMessage="O provedor não retornou o valor da cota arquivado para este fundo."
        />

        <AppText variant="caption" tone="secondary">
          É a contabilidade do fundo, não o preço de mercado: a cota do gráfico
          acima negocia, esta é arquivada.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
