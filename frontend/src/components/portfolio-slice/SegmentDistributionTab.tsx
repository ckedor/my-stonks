import AllocationPie from '@/components/portfolio-rebalancing/AllocationPie'
import {
  AppCard,
  AppGrid,
  AppGridItem,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { groupConcentration } from './concentration'
import { CONCENTRATION_DIMENSIONS } from './concentration'
import type { PortfolioPositionEntry } from '@/types'

/* Como um segmento está distribuído por dentro.
 *
 * Um segmento não tem alvo, e é isso que o separa de uma categoria. A alocação
 * alvo pertence à categoria personalizada — é ela que o rebalanceamento
 * compara —, e um segmento corta a carteira por tipo de ativo, atravessando
 * várias categorias. Mostrar aqui o alvo das categorias que o segmento toca
 * respondia outra pergunta: dizia quanto "EUA" deveria pesar na carteira
 * inteira, e não como este pedaço está repartido.
 *
 * Então a aba mostra o que o segmento de fato tem: quanto pesa cada ativo
 * dentro dele. Sem alvo e sem aporte simulado, porque não há alvo para
 * comparar.
 */

interface Props {
  positions: PortfolioPositionEntry[]
}

export default function SegmentDistributionTab({ positions }: Props) {
  const { format: fmt } = useCurrency()
  const theme = useAppTheme()

  const entries = groupConcentration(positions, CONCENTRATION_DIMENSIONS.asset)
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)

  if (entries.length === 0) {
    return <AppText tone="secondary">Sem posição para distribuir.</AppText>
  }

  const colorAt = (index: number) =>
    theme.palette.chart.colors[index % theme.palette.chart.colors.length]

  const columns: AppSimpleTableColumn<(typeof entries)[number]>[] = [
    { label: 'Ativo', width: 'clamped', render: (entry) => entry.label },
    {
      label: 'Valor',
      align: 'right',
      sortValue: (entry) => entry.value,
      render: (entry) => fmt(entry.value),
    },
    {
      label: '% do segmento',
      align: 'right',
      sortValue: (entry) => entry.value,
      render: (entry) =>
        total > 0 ? `${((entry.value / total) * 100).toFixed(2)}%` : '—',
    },
  ]

  return (
    <AppGrid cols={{ xs: 1, md: 2 }} gap="lg" align="stretch">
      <AppGridItem>
        <AppStack gap="md">
          <SectionTitle>Peso de cada ativo</SectionTitle>
          <AppCard>
            <AllocationPie
              slices={entries.map((entry, index) => ({
                label: entry.label,
                value: entry.value,
                color: colorAt(index),
              }))}
            />
          </AppCard>
        </AppStack>
      </AppGridItem>
      <AppGridItem>
        <AppStack gap="md">
          <SectionTitle>Composição</SectionTitle>
          <AppCard>
            <AppSimpleTable
              rows={entries}
              columns={columns}
              getRowKey={(entry) => entry.label}
              defaultSort={{ column: 'Valor', direction: 'desc' }}
            />
          </AppCard>
        </AppStack>
      </AppGridItem>
    </AppGrid>
  )
}
