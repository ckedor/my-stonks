// src/pages/PortfolioReturnsPage.tsx
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { Box, Grid, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import PortfolioMonthlyHeatmap from './PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from './PortfolioMonthlyReturnsChart'
import PortfolioRolling12mChart from './PortfolioRolling12mChart'

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
    <Box sx={{ p: 1, pt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Rentabilidade Carteira</Typography>
      <Grid container spacing={2}>
        {/* Performance metrics row */}
        {/* Linha 1 - Gráfico principal full width */}
        <Grid size={12}>
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
        </Grid>

        {/* Linha 2 - Heatmap full width */}
        <Grid size={12}>
          <AppCard>
            <PortfolioMonthlyHeatmap 
              data={portfolioData} 
            />
          </AppCard>
        </Grid>

        {/* Linha 3 - 2 gráficos lado a lado */}
        <Grid size={{ xs: 12, md: 6 }}>
          <AppCard>
            <PortfolioMonthlyReturnsChart
              height={300}
              defaultRange={range}
              data={portfolioData}
            />
          </AppCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AppCard>
            <PortfolioRolling12mChart
              height={300}
              data={portfolioData}
            />
          </AppCard>
        </Grid>
      </Grid>
    </Box>
  )
}
