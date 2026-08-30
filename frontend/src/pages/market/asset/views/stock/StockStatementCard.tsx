import type { StockStatementPoint } from '@/api/market'
import {
  AppCard,
  AppDivider,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { useMemo } from 'react'
import { formatCompactBRL, formatDate } from '../format'
import PublishedSeriesChart, { type PublishedSeriesMetric } from '../PublishedSeriesChart'
import { statementLineLabel, type StatementGroup } from './labels'

/** Um demonstrativo arquivado: a série de umas poucas linhas, e o último
 *  período inteiro.
 *
 *  Os quatro demonstrativos usam este mesmo card porque são a mesma forma —
 *  uma peça contábil é uma lista de linhas datada, e o que muda entre balanço,
 *  DRE, caixa e DVA é quais linhas e como se agrupam. Quatro cards iguais
 *  divergiriam no primeiro ajuste que alguém fizesse em um deles.
 *
 *  A série vem primeiro porque uma linha contábil sozinha não diz quase nada:
 *  R$ 169 bi de receita num trimestre só significa alguma coisa contra os
 *  trimestres anteriores. O período mais recente vem abaixo, inteiro, para
 *  quem veio ler a peça e não a tendência.
 *
 *  Uma linha que a companhia não arquivou não aparece, e um grupo que ficou
 *  sem nenhuma linha some junto: um banco não tem estoque, e "Estoques —" numa
 *  tabela de banco é uma afirmação errada com cara de dado faltando.
 */
export default function StockStatementCard({
  title,
  points,
  groups,
  metrics,
  note,
}: {
  title: string
  points: StockStatementPoint[]
  groups: StatementGroup[]
  /** As poucas linhas que valem uma série. Uma peça tem dezenas; um seletor
   *  com dezenas de opções não é um seletor, é um índice. */
  metrics: PublishedSeriesMetric<StockStatementPoint>[]
  note?: string
}) {
  const latest = points.length ? points[points.length - 1] : null

  /* Os grupos que esta companhia de fato arquivou. O filtro é sobre o que veio
     no período aberto, e não sobre o catálogo de linhas possíveis. */
  const filled = useMemo(() => {
    if (!latest) return []
    return groups
      .map((group) => ({
        label: group.label,
        rows: group.keys
          .filter((key) => latest.lines[key] !== undefined)
          .map((key) => ({ key, value: latest.lines[key] })),
      }))
      .filter((group) => group.rows.length > 0)
  }, [groups, latest])

  const available = useMemo(
    () => metrics.filter((metric) => points.some((point) => metric.read(point) != null)),
    [metrics, points]
  )

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" gap="sm" justify="between" align="baseline" wrap>
          <SectionTitle>{title}</SectionTitle>
          {latest?.end_date && (
            <AppText variant="caption" tone="secondary">
              Último período arquivado: {formatDate(latest.end_date)}
            </AppText>
          )}
        </AppStack>

        {available.length > 0 && (
          <PublishedSeriesChart
            points={points}
            dateOf={(point) => point.end_date}
            metrics={available}
            label={`Linha de ${title.toLocaleLowerCase('pt-BR')}`}
            emptyMessage="A companhia não arquivou esta linha no período."
          />
        )}

        {filled.map((group) => (
          <AppStack key={group.label} gap="xs">
            <SectionLabel>{group.label}</SectionLabel>
            {group.rows.map((row) => (
              <AppStack
                key={row.key}
                direction="row"
                gap="sm"
                justify="between"
                align="baseline"
                wrap
              >
                <AppText variant="bodySmall" tone="secondary">
                  {statementLineLabel(row.key)}
                </AppText>
                <AppText variant="bodySmall">{formatCompactBRL(row.value)}</AppText>
              </AppStack>
            ))}
            <AppDivider />
          </AppStack>
        ))}

        {!latest && (
          <AppText variant="bodySmall" tone="secondary">
            A companhia não tem este demonstrativo publicado pelo provedor.
          </AppText>
        )}

        <AppText variant="caption" tone="secondary">
          {note ?? 'Valores em reais, como arquivados pela companhia.'}
        </AppText>
      </AppStack>
    </AppCard>
  )
}
