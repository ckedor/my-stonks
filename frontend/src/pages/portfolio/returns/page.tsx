import { WHOLE_PORTFOLIO_CURVE, useReturnCurves } from '@/queries/portfolio'
// src/pages/PortfolioReturnsPage.tsx
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import {
  AppCard,
  AppChartSkeleton,
  AppGrid,
  AppGridItem,
  AppPageHeader,
  AppPageHeaderSkeleton,
  AppStack,
} from '@/components/ui'
import { useMemo, useState } from 'react'
import PortfolioMonthlyHeatmap from '@/components/PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from '@/components/PortfolioMonthlyReturnsChart'
import PortfolioRolling12mChart from '@/components/PortfolioRolling12mChart'

interface SeriesPoint {
  date: string
  value: number
}

export default function PortfolioReturnsPage() {
  const { series: categoryReturns, isPending: loading } = useReturnCurves()

  const [range, setRange] = useState<string>('max')

  // Busca os dados do portfolio
  const portfolioData: SeriesPoint[] = useMemo(() => {
    return (categoryReturns[WHOLE_PORTFOLIO_CURVE] ?? []).slice()
  }, [categoryReturns])

  if (loading) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={260} />
        <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
          <AppGridItem span={{ xs: 1, md: 2 }}>
            <AppChartSkeleton height={520} toolbar surface="card" />
          </AppGridItem>
          <AppGridItem span={{ xs: 1, md: 2 }}>
            <AppChartSkeleton height={260} surface="card" />
          </AppGridItem>
          <AppGridItem>
            <AppChartSkeleton height={300} toolbar surface="card" />
          </AppGridItem>
          <AppGridItem>
            <AppChartSkeleton height={300} toolbar surface="card" />
          </AppGridItem>
        </AppGrid>
      </AppStack>
    )
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
