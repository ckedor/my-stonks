import AssetDrawer from '@/components/AssetDrawer'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useAnalysisStore } from '@/stores/portfolio/analysis'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { Box, Button, Grid, Tab, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import PortfolioMonthlyAportsChart from '../wealth/PortfolioMonthlyAportsChart'
import OverviewDividendsChart from './OverviewDividendsChart'
import OverviewPatrimonyChart from './OverviewPatrimonyChart'
import OverviewReturnsChart from './OverviewReturnsChart'
import OverviewSkeleton from './OverviewSkeleton'
import PositionPieChart from './PositionPieChart'
import PositionTable from './PositionTable'

export default function PortfolioOverviewPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const { openTradeForm } = useTradeFormStore()

  const positions = usePositionsStore(s => s.positions)
  const positionsLoading = usePositionsStore(s => s.loading)
  const patrimonyEvolution = usePatrimonyStore(s => s.patrimony)
  const dividends = useDividendsStore(s => s.dividends)
  const returnsLoading = useReturnsStore(s => s.loading)
  const categoryCagr = useReturnsStore(s => s.categoryCagr)

  const { analysis } = useAnalysisStore()
  const { format: formatCurrency } = useCurrency()

  const totalValue = positions.reduce((s, p) => s + p.value, 0)
  const cagrRaw = categoryCagr['portfolio'] ?? null
  const cagr = cagrRaw != null ? cagrRaw * 100 : null
  const cdiMetrics = analysis?.performance_metrics?.benchmarks_metrics?.['CDI']
  const cdiCagr = cdiMetrics?.cagr
  const cdiPct = cagr != null && cdiCagr != null && cdiCagr !== 0
    ? ((cagr / cdiCagr) * 100)
    : null

  const hasCagr = Object.keys(categoryCagr).length > 0
  const loading = (positionsLoading && positions.length === 0) || (returnsLoading && !hasCagr)

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [bottomTab, setBottomTab] = useState(0)
  const [drawerAssetId, setDrawerAssetId] = useState<number | null>(null)

  if (loading) {
    return <OverviewSkeleton />
  }

  if (!loading && positions.length === 0) {
    return (
      <Box
        height="80vh"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <Typography variant="h6" gutterBottom>
          Sua carteira ainda está vazia
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Comece cadastrando sua primeira compra
        </Typography>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => openTradeForm()}
        >
          Cadastrar Primeira Compra
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* ── Hero: Patrimony ── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Patrimônio
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {formatCurrency(totalValue)}
        </Typography>
        {cagr != null && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: cagr >= 0 ? 'success.main' : 'error.main' }}
            >
              CAGR {cagr >= 0 ? '+' : ''}{cagr.toFixed(2)}%
            </Typography>
            {cdiPct != null && (
              <Typography variant="body2" color="text.secondary">
                ({cdiPct.toFixed(0)}% do CDI)
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* ── Row 1: Returns chart (70%) + Pie (30%) ── */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <OverviewReturnsChart size={360} selectedCategory={selectedCategory} />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <PositionPieChart
            positions={positions}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAssetSelect={setDrawerAssetId}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Position list + Dividends/Patrimony tab ── */}
      <Grid container spacing={3} sx={{ mt: 2 }} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 5 }}>
          <PositionTable
            positions={positions}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAssetSelect={setDrawerAssetId}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Tabs
            value={bottomTab}
            onChange={(_, v) => setBottomTab(v)}
            sx={{
              minHeight: 32,
              mb: 1.5,
              '& .MuiTabs-indicator': {
                height: 2,
                borderRadius: 1,
              },
              '& .MuiTab-root': {
                minHeight: 32,
                textTransform: 'none',
                fontSize: 13,
                fontWeight: 500,
                px: 1.5,
                py: 0.3,
                color: 'text.secondary',
                '&.Mui-selected': {
                  fontWeight: 600,
                  color: 'text.primary',
                },
              },
            }}
          >
            <Tab label="Proventos" />
            <Tab label="Patrimônio" />
            <Tab label="Aportes" />
          </Tabs>

          {bottomTab === 0 && (
            <OverviewDividendsChart dividends={dividends} selected={selectedCategory} size={320} />
          )}
          {bottomTab === 1 && (
            <OverviewPatrimonyChart
              patrimonyEvolution={patrimonyEvolution}
              selected={selectedCategory}
              size={320}
            />
          )}
          {bottomTab === 2 && (
            <PortfolioMonthlyAportsChart height={320} groupBy="month" defaultRange="max" />
          )}
        </Grid>
      </Grid>

      <AssetDrawer
        assetId={drawerAssetId}
        open={drawerAssetId !== null}
        onClose={() => setDrawerAssetId(null)}
      />
    </Box>
  )
}
