// src/pages/PortfolioReturnsPage.tsx
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import {
  AppCard,
  AppPageHeader,
  AppGrid,
  AppGridItem,
  AppStack,
  LoadingSpinner,
} from '@/components/ui'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useEffect, useMemo, useState } from 'react'
import PortfolioMonthlyHeatmap from '@/components/PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from '@/components/PortfolioMonthlyReturnsChart'
import PortfolioRolling12mChart from '@/components/PortfolioRolling12mChart'

interface SeriesPoint {
  date: string
  value: number
}

export default function PortfolioReturnsPage() {
  const { categoryReturns, loading: returnsLoading } = useReturnsStore()

  const loading = returnsLoading && Object.keys(categoryReturns).length === 0

  const [range, setRange] = useState<string>('max')

  useEffect(() => {
    if (!useReturnsStore.persist.hasHydrated()) {
      const id = setTimeout(() => useReturnsStore.persist.rehydrate(), 0)
      return () => clearTimeout(id)
    }
  }, [])

  // Busca os dados do portfolio
  const portfolioData: SeriesPoint[] = useMemo(() => {
    return (categoryReturns['portfolio'] || []).slice()
  }, [categoryReturns])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Rentabilidade"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Rentabilidade' },
        ]}
      />

      <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
        {/* O gráfico principal e o mapa mensal ocupam a linha inteira; os
            dois menores dividem a última. */}
        <AppGridItem span={{ xs: 1, md: 2 }}>
          <AppCard>
            <PortfolioReturnsChart
              size={520}
              selectedCategory="portfolio"
              selectedBenchmark="CDI"
              defaultRange={range}
              onRangeChange={setRange}
              persistKey="portfolio-returns"
            />
          </AppCard>
        </AppGridItem>

        <AppGridItem span={{ xs: 1, md: 2 }}>
          <AppCard>
            <PortfolioMonthlyHeatmap data={portfolioData} />
          </AppCard>
        </AppGridItem>

        <AppGridItem>
          <AppCard>
            <PortfolioMonthlyReturnsChart height={300} defaultRange={range} data={portfolioData} />
          </AppCard>
        </AppGridItem>

        <AppGridItem>
          <AppCard>
            <PortfolioRolling12mChart height={300} data={portfolioData} />
          </AppCard>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
