import { useQuery } from '@tanstack/react-query'
import { useSelectedPortfolio } from '@/queries/portfolio'
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
  AppPageHeader,
  AppSkeleton,
  AppSnackbar,
  AppStack,
  AppStackItem,
  AppSwitch,
  AppTabs,
  AppTableSkeleton,
  AppText,
  AppToggleGroup,
  SectionTitle,
  type AppToggleGroupOption,
} from '@/components/ui'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import PerformanceBarChart, { type DistributionMetric } from '@/pages/portfolio/asset/PerformanceBarChart'
import PortfolioHeatMap from '@/pages/portfolio/asset/PortfolioHeatMap'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* Duas leituras, e não uma pilha: o mapa responde "como a carteira ficou" e
   os alvos, "o quanto isso difere do que eu quero". Empilhadas, a segunda
   ficava a uma rolagem inteira da primeira e o mapa saía da tela justamente
   quando os alvos precisavam dele. Como abas, cada uma ocupa a dobra sozinha
   e a troca custa um clique. */
const TABS = [
  { id: 'map' as const, label: 'Distribuição' },
  { id: 'targets' as const, label: 'Alvos' },
]

type DistributionTab = (typeof TABS)[number]['id']

const METRIC_OPTIONS: AppToggleGroupOption<DistributionMetric>[] = [
  { value: 'twelve_months_return', label: 'Rent. 12M' },
  { value: 'acc_return', label: 'Rent. Acumulada' },
  { value: 'cagr', label: 'CAGR' },
  { value: 'profit', label: 'Lucro' },
]

/** Largura da coluna de barras ao lado do mapa. */
const BAR_COLUMN_WIDTH = 360

/** Altura do mapa. Fixa, e não a tela inteira: os alvos vêm logo abaixo, e um
 *  mapa que toma a dobra sozinho esconde a metade que responde "e daí?". */
const MAP_HEIGHT = 620

/** Onde o dinheiro está, e onde ele deveria estar.
 *
 *  As duas metades eram duas telas — Distribuição e Rebalanceamento — e a
 *  segunda só fazia sentido depois de ler a primeira: o mapa mostra como a
 *  carteira ficou, e a tabela de alvos mostra o quanto isso difere do que se
 *  quer. Separá-las obrigava a manter o mapa na cabeça enquanto se lia a
 *  tabela. */
export default function DistributionPage() {
  const selectedPortfolio = useSelectedPortfolio()
  const navigate = useNavigate()
  const portfolioId = selectedPortfolio?.id

  const { format: fmt, symbol: currencySymbol } = useCurrency()
  const [metric, setMetric] = useState<DistributionMetric>('twelve_months_return')
  const [tab, setTab] = useState<DistributionTab>('map')

  const { data: positions } = useQuery<any[]>({
    queryKey: [portfolioId ? `distribution:positions:${portfolioId}` : null],
    queryFn: useCallback(
      () => api.get(POSITION_ROUTES.byPortfolio(portfolioId!)).then(r => r.data),
      [portfolioId],
    ),
    enabled: (portfolioId ? `distribution:positions:${portfolioId}` : null) != null && !!portfolioId,
  })

  const rebalancing = useRebalancing(portfolioId)
  const { view, simulating, contribution, categoryTargetSum } = rebalancing

  const loading = !positions && !!portfolioId

  const handleAssetSelect = useCallback((assetId: number) => {
    navigate(`/portfolio/asset/${assetId}`)
  }, [navigate])

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Distribuição"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Distribuição' },
        ]}
        actions={
          /* A métrica é do mapa: fora dele, o controle não tem o que mudar. */
          tab === 'map' ? (
            <AppToggleGroup
              label="Métrica"
              options={METRIC_OPTIONS}
              value={metric}
              onChange={setMetric}
            />
          ) : undefined
        }
      />

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Visões da distribuição" />

      {tab === 'map' && (loading ? (
        <AppStack direction="row" gap="md" collapseBelow="md">
          <AppStackItem>
            <AppSkeleton height={MAP_HEIGHT} />
          </AppStackItem>
          <AppStackItem width={BAR_COLUMN_WIDTH} offsetTop="xxl">
            <AppSkeleton height={520} />
          </AppStackItem>
        </AppStack>
      ) : (
        <AppStack direction="row" gap="md" collapseBelow="md">
          <AppStackItem>
            <PortfolioHeatMap
              positions={positions ?? []}
              metric={metric}
              onAssetSelect={handleAssetSelect}
              height={MAP_HEIGHT}
            />
          </AppStackItem>
          {/* Empurrada para baixo para começar na mesma linha do primeiro
              bloco do mapa, que reserva o topo para o nome da categoria. */}
          <AppStackItem width={BAR_COLUMN_WIDTH} offsetTop="xxl">
            <PerformanceBarChart
              positions={positions ?? []}
              metric={metric}
              onAssetSelect={handleAssetSelect}
            />
          </AppStackItem>
        </AppStack>
      ))}

      {tab === 'targets' && (rebalancing.loading ? (
        <>
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
        </>
      ) : !view || view.categories.length === 0 ? (
        <AppText tone="secondary">Nenhuma posição encontrada para rebalancear.</AppText>
      ) : (
        <>
          <AppCard>
            <AppStack direction="row" gap="lg" align="end" justify="between" wrap>
              <AppStack direction="row" gap="lg" wrap>
                <AppMetric label="Patrimônio" value={fmt(view.total_value)} size="lg" />
                {simulating && (
                  <>
                    <AppMetric label="Aporte" value={contribution ? fmt(contribution) : '—'} />
                    <AppMetric label="Carteira depois" value={fmt(rebalancing.effectiveTotal)} />
                  </>
                )}
                <AppMetric
                  label="Soma dos alvos"
                  value={
                    categoryTargetSum > 0
                      ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%`
                      : '—'
                  }
                  tone={
                    categoryTargetSum > 0 && Math.abs(categoryTargetSum - 100) > 0.01
                      ? 'danger'
                      : 'default'
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
                <AppButton
                  icon={<SaveIcon />}
                  loading={rebalancing.saving}
                  onClick={rebalancing.save}
                >
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
        </>
      ))}

      <AppSnackbar
        open={rebalancing.snackbar.open}
        message={rebalancing.snackbar.message}
        severity={rebalancing.snackbar.severity}
        onClose={rebalancing.closeSnackbar}
      />
    </AppStack>
  )
}
