
import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import Trades from '@/components/Trades'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { PatrimonyEntry, PortfolioPositionEntry } from '@/types'
import { Alert, Box, Grid, Paper, Snackbar, Tab, Tabs, Typography } from '@mui/material'
import { useCallback, useState } from 'react'
import PensionPieChart from './PensionPieChart'
import PensionTable from './PensionTable'

export default function PensionPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const portfolioId = selectedPortfolio?.id

  const { data: positionData } = useCachedData<PortfolioPositionEntry[]>(
    portfolioId ? `pension:positions:${portfolioId}` : null,
    useCallback(() => api.get(POSITION_ROUTES.byPortfolio(portfolioId!), {
      params: { asset_type_id: ASSET_TYPES.PREV },
    }).then(r => r.data), [portfolioId]),
    { enabled: !!portfolioId },
  )
  const { data: patrimonyData } = useCachedData<PatrimonyEntry[]>(
    portfolioId ? `pension:patrimony:${portfolioId}` : null,
    useCallback(() => api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId!), {
      params: { asset_type_id: ASSET_TYPES.PREV },
    }).then(r => r.data), [portfolioId]),
    { enabled: !!portfolioId },
  )

  const positions = positionData ?? []
  const patrimony = patrimonyData ?? []
  const isLoading = !positionData && !!portfolioId

  const loading = isLoading

  const [tabIndex, setTabIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Previdência</Typography>
      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container direction="row">
            <Grid size={{ xs: 12 }} mt={1}>
              <PensionTable data={positions} />
            </Grid>
          </Grid>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <PensionPieChart data={positions} />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={3}>
        {/* Rentabilidade (esquerda) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box borderBottom={1} borderColor="divider">
            <Tabs
              value={tabIndex}
              onChange={(_, newIndex) => setTabIndex(newIndex)}
              aria-label="Previdência Tabs"
            >
              <Tab label="Rentabilidade" />
            </Tabs>
          </Box>

          <Box mt={2}>
            {tabIndex === 0 && <PortfolioReturnsChart size={295} selectedCategory="Previdência" />}
          </Box>
        </Grid>

        {/* Evolução Patrimonial (direita) */}
        <Grid size={{ xs: 12, md: 6 }} mt={1}>
          <Box display="flex" alignItems="left" mb={6} ml={5}>
            <Typography variant="h6">Evolução Patrimonial</Typography>
          </Box>
          <PortfolioPatrimonyChart
            patrimonyEvolution={patrimony}
            selected="Previdência"
            size={300}
          />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 24 }}>
          <Paper variant="outlined">
            <Trades assetTypes={[ASSET_TYPES.PREV]} currencyId={1} />
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  )
}
