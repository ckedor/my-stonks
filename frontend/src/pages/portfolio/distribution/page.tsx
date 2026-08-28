import {
  AppPageHeader,
  AppSkeleton,
  AppStack,
  AppStackItem,
  AppToggleGroup,
  type AppToggleGroupOption,
} from '@/components/ui'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import api from '@/lib/api'
import PerformanceBarChart, { type DistributionMetric } from '@/pages/portfolio/asset/PerformanceBarChart'
import PortfolioHeatMap from '@/pages/portfolio/asset/PortfolioHeatMap'
import { usePortfolioStore } from '@/stores/portfolio'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const METRIC_OPTIONS: AppToggleGroupOption<DistributionMetric>[] = [
  { value: 'twelve_months_return', label: 'Rent. 12M' },
  { value: 'acc_return', label: 'Rent. Acumulada' },
  { value: 'cagr', label: 'CAGR' },
  { value: 'profit', label: 'Lucro' },
]

/** Largura da coluna de barras ao lado do mapa. */
const BAR_COLUMN_WIDTH = 360

export default function DistributionPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const navigate = useNavigate()
  const portfolioId = selectedPortfolio?.id

  const [metric, setMetric] = useState<DistributionMetric>('twelve_months_return')

  const { data: positions } = useCachedData<any[]>(
    portfolioId ? `distribution:positions:${portfolioId}` : null,
    useCallback(
      () => api.get(POSITION_ROUTES.byPortfolio(portfolioId!)).then(r => r.data),
      [portfolioId],
    ),
    { enabled: !!portfolioId },
  )

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
          <AppToggleGroup
            label="Métrica"
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
          />
        }
      />

      {loading ? (
        <AppStack direction="row" gap="md" collapseBelow="md">
          <AppStackItem>
            <AppSkeleton height={560} />
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
      )}
    </AppStack>
  )
}
