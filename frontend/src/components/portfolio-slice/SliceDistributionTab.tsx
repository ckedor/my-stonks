import SaveIcon from '@mui/icons-material/Save'

import AllocationPie from '@/components/portfolio-rebalancing/AllocationPie'
import RebalancingTable from '@/components/portfolio-rebalancing/RebalancingTable'
import { useRebalancing } from '@/components/portfolio-rebalancing/useRebalancing'
import {
  AppButton,
  AppCard,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppNumberField,
  AppSkeleton,
  AppSnackbar,
  AppStack,
  AppSwitch,
  AppTableSkeleton,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'

interface Props {
  portfolioId: number
  /** As categorias que este recorte toca. O alvo é sempre da categoria, então
   *  é a categoria que entra ou fica de fora — nunca meia categoria. */
  categoryNames: string[]
}

/** Como o recorte está distribuído, e como ele deveria estar.
 *
 *  Distribuição e rebalanceamento são a mesma pergunta em dois tempos — onde o
 *  dinheiro está, onde ele deveria estar —, e ficam juntos por isso. Mostra as
 *  categorias que o recorte toca, com os números que de fato valem: o alvo de
 *  uma categoria é a fatia dela na carteira, e continua sendo isso aqui. O que
 *  muda é a base de "% Atual" e do aporte simulado, que passam a ser essas
 *  categorias — a pergunta da aba é onde colocar dinheiro *dentro deste
 *  pedaço*, e não na carteira toda.
 *
 *  Salvar envia o rascunho inteiro: um alvo de categoria que esta aba não
 *  mostra não se perde por ter sido editado noutro lugar. */
export default function SliceDistributionTab({ portfolioId, categoryNames }: Props) {
  const { format: fmt, symbol: currencySymbol } = useCurrency()
  const rebalancing = useRebalancing(portfolioId, { categoryNames })
  const { view, simulating, contribution, categoryTargetSum } = rebalancing

  if (rebalancing.loading) {
    return (
      <AppStack gap="lg">
        <AppCard>
          <AppSkeleton height={56} />
        </AppCard>
        <AppGrid cols={{ xs: 1, md: 2 }} gap="lg" align="stretch">
          {Array.from({ length: 2 }).map((_, index) => (
            <AppGridItem key={index}>
              <AppCard>
                <AppStack gap="sm">
                  <AppSkeleton shape="text" width={140} height={24} />
                  <AppSkeleton height={280} />
                </AppStack>
              </AppCard>
            </AppGridItem>
          ))}
        </AppGrid>
        <AppCard padding="md">
          <AppTableSkeleton columns={6} rows={8} />
        </AppCard>
      </AppStack>
    )
  }

  if (!view || view.categories.length === 0) {
    return (
      <AppText tone="secondary">
        Nenhuma categoria com posição neste recorte para distribuir.
      </AppText>
    )
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" align="end" justify="between" wrap>
          <AppStack direction="row" gap="lg" wrap>
            <AppMetric label="Patrimônio do recorte" value={fmt(view.total_value)} size="lg" />
            {simulating && (
              <>
                <AppMetric label="Aporte" value={contribution ? fmt(contribution) : '—'} />
                <AppMetric label="Depois do aporte" value={fmt(rebalancing.effectiveTotal)} />
              </>
            )}
            <AppMetric
              label="Soma dos alvos"
              value={
                categoryTargetSum > 0
                  ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%`
                  : '—'
              }
            />
          </AppStack>

          <AppStack direction="row" gap="md" align="end" wrap>
            <AppSwitch
              label="Simular aporte"
              hint="Distribui o dinheiro novo comprando o que está mais atrasado, sem sugerir venda."
              checked={simulating}
              onChange={rebalancing.setSimulating}
            />
            {simulating && (
              <AppNumberField
                label="Aporte"
                size="md"
                allowEmpty
                step={0.01}
                prefix={currencySymbol}
                value={contribution}
                onChange={rebalancing.setContribution}
              />
            )}
            <AppButton icon={<SaveIcon />} loading={rebalancing.saving} onClick={rebalancing.save}>
              Salvar alvos
            </AppButton>
          </AppStack>
        </AppStack>
      </AppCard>

      <AppGrid cols={{ xs: 1, md: 2 }} gap="lg" align="stretch">
        <AppGridItem>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Hoje</SectionTitle>
              <AllocationPie slices={rebalancing.pies.current} />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>{simulating ? 'Depois do aporte' : 'No alvo'}</SectionTitle>
              <AllocationPie slices={rebalancing.pies.suggested} />
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <RebalancingTable
        view={view}
        buyPlan={rebalancing.buyPlan}
        openCategories={rebalancing.openCategories}
        onToggleCategory={rebalancing.toggleCategory}
        onCategoryTargetChange={rebalancing.setCategoryTarget}
        onAssetTargetChange={rebalancing.setAssetTarget}
        simulating={simulating}
        contribution={contribution}
        categoryTargetSum={categoryTargetSum}
      />

      <AppSnackbar
        open={rebalancing.snackbar.open}
        message={rebalancing.snackbar.message}
        severity={rebalancing.snackbar.severity}
        onClose={rebalancing.closeSnackbar}
      />
    </AppStack>
  )
}
