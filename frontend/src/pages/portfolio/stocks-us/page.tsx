
import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import Trades from '@/components/Trades'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { PatrimonyEntry, StockPortfolioPositionEntry } from '@/types'
import {
    Alert,
    Box,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    Snackbar,
    Tab,
    Tabs,
    Typography,
} from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import StocksPieChart from '../stocks-br/StocksPieChart'
import StocksTable from '../stocks-br/StocksTable'

export default function StocksEuaPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const portfolioId = selectedPortfolio?.id
  const { currency } = useCurrency()

  const { data: positionData } = useCachedData<StockPortfolioPositionEntry[]>(
    portfolioId ? `stocks-us:positions:${portfolioId}:${currency}` : null,
    useCallback(() => api.get(POSITION_ROUTES.byPortfolio(portfolioId!), {
      params: { asset_type_ids: [ASSET_TYPES.STOCK, ASSET_TYPES.BDR, ASSET_TYPES.ETF], currency_id: 2, currency },
    }).then(r => r.data), [portfolioId, currency]),
    { enabled: !!portfolioId },
  )
  const { data: patrimonyData } = useCachedData<PatrimonyEntry[]>(
    portfolioId ? `stocks-us:patrimony:${portfolioId}:${currency}` : null,
    useCallback(() => api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId!), {
      params: { asset_type_ids: [ASSET_TYPES.STOCK, ASSET_TYPES.BDR, ASSET_TYPES.ETF], currency },
    }).then(r => r.data), [portfolioId, currency]),
    { enabled: !!portfolioId },
  )

  const positions = positionData ?? []
  const patrimony = patrimonyData ?? []
  const isLoading = !positionData && !!portfolioId

  const loading = isLoading

  const [tabIndex, setTabIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'ticker' | 'sector' | 'industry'>('ticker')
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos')

  const availableFilters = useMemo(() => {
    const unique = new Set(positions.map((stock) => stock[groupBy]))
    return ['Todos', ...Array.from(unique)]
  }, [groupBy, positions])

  const filteredStocks = useMemo(() => {
    if (selectedGroup === 'Todos') return positions
    return positions.filter((stock) => stock[groupBy] === selectedGroup)
  }, [positions, groupBy, selectedGroup])

  function renderMenu() {
    return (
      <Box display="flex" gap={2}>
        <FormControl size="small">
          <InputLabel>Agrupar por</InputLabel>
          <Select
            sx={{ minWidth: '130px' }}
            value={groupBy}
            onChange={(e: SelectChangeEvent) => {
              setGroupBy(e.target.value as any)
              setSelectedGroup('Todos')
            }}
            label="Agrupar por"
          >
            <MenuItem value="ticker">Ativo</MenuItem>
            <MenuItem value="sector">Setor</MenuItem>
            <MenuItem value="industry">Indústria</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Filtro</InputLabel>
          <Select
            sx={{ minWidth: '130px' }}
            value={selectedGroup}
            onChange={(e: SelectChangeEvent) => setSelectedGroup(e.target.value)}
            label="Filtro"
          >
            {availableFilters.map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    )
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Ações EUA</Typography>
      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container direction="row">
            <Grid size={{ xs: 12 }}>{renderMenu()}</Grid>
            <Grid size={{ xs: 12 }} mt={1}>
              <StocksTable data={positions} />
            </Grid>
          </Grid>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StocksPieChart data={filteredStocks} groupBy="ticker" />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box borderBottom={1} borderColor="divider">
            <Tabs
              value={tabIndex}
              onChange={(_, newIndex) => setTabIndex(newIndex)}
              aria-label="Ações EUA Tabs"
            >
              <Tab label="Rentabilidade" />
            </Tabs>
          </Box>

          <Box mt={2}>
            {tabIndex === 0 && <PortfolioReturnsChart size={295} selectedCategory="Ações EUA" />}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }} mt={1}>
          <Box display="flex" alignItems="left" mb={6} ml={5}>
            <Typography variant="h6">Evolução Patrimonial</Typography>
          </Box>
          <PortfolioPatrimonyChart
            patrimonyEvolution={patrimony}
            selected="portfolio"
            size={300}
          />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 24 }}>
          <Paper variant="outlined">
            <Trades assetTypes={[ASSET_TYPES.ETF, ASSET_TYPES.STOCK]} currencyId={2} />
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
