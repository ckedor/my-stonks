
import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import Trades from '@/components/Trades'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { DIVIDEND_ROUTES, POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Dividend, FixedIncomePositionEntry, PatrimonyEntry } from '@/types'
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
import FixedIncomeDividendsChart from './FixedIncomeDividendsChart'
import FixedIncomePieChart from './FixedIncomePieChart'
import FixedIncomeTable from './FixedIncomeTable'

const asset_type_ids = [
  ASSET_TYPES.CDB,
  ASSET_TYPES.DEB,
  ASSET_TYPES.CRI,
  ASSET_TYPES.CRA,
  ASSET_TYPES.TREASURY,
]

export default function FixedIncomePage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const portfolioId = selectedPortfolio?.id
  const { currency } = useCurrency()

  const { data: positionData } = useCachedData<FixedIncomePositionEntry[]>(
    portfolioId ? `fixed-income:positions:${portfolioId}:${currency}` : null,
    useCallback(() => api.get(POSITION_ROUTES.byPortfolio(portfolioId!), {
      params: { asset_type_ids: asset_type_ids, currency },
    }).then(r => r.data), [portfolioId, currency]),
    { enabled: !!portfolioId },
  )
  const { data: dividendsData } = useCachedData<Dividend[]>(
    portfolioId ? `fixed-income:dividends:${portfolioId}:${currency}` : null,
    useCallback(() => api.get(DIVIDEND_ROUTES.list, {
      params: { portfolio_id: portfolioId, asset_type_ids, currency },
    }).then(r => r.data), [portfolioId, currency]),
    { enabled: !!portfolioId },
  )
  const { data: patrimonyRaw } = useCachedData<PatrimonyEntry[]>(
    portfolioId ? `fixed-income:patrimony:${portfolioId}:${currency}` : null,
    useCallback(() => api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId!), {
      params: { asset_type_ids, currency },
    }).then(r => r.data), [portfolioId, currency]),
    { enabled: !!portfolioId },
  )

  const positions = positionData ?? []
  const dividends = dividendsData ?? []
  const patrimony = patrimonyRaw ?? []
  const isLoading = !positionData && !!portfolioId

  const loading = isLoading

  const [groupBy, setGroupBy] = useState<'ticker' | 'fixed_income_type' | 'fixed_income_index_name'>('ticker')
  const [selectedGroup, setSelectedGroup] = useState<string>('Todos')
  const [tabIndex, setTabIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const availableFilters = useMemo(() => {
    const unique = new Set(positions.map((item) => item[groupBy]))
    return ['Todos', ...Array.from(unique)]
  }, [groupBy, positions])

  const filteredData = useMemo(() => {
    if (selectedGroup === 'Todos') return positions
    return positions.filter((item) => item[groupBy] === selectedGroup)
  }, [positions, groupBy, selectedGroup])

  const filteredDividends = useMemo(() => {
    const ativosSelecionados = filteredData.map((item) => item.ticker)
    return dividends.filter((d) => ativosSelecionados.includes(d.ticker))
  }, [filteredData, dividends])

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
            <MenuItem value="fixed_income_type">Tipo</MenuItem>
            <MenuItem value="fixed_income_index_name">Indexador</MenuItem>
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
            {availableFilters.map((v) =>
              v != null ? (
                <MenuItem key={String(v)} value={String(v)}>
                  {v}
                </MenuItem>
              ) : null
            )}
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
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Renda Fixa</Typography>
      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container direction="row">
            <Grid size={{ xs: 12 }}>{renderMenu()}</Grid>
            <Grid size={{ xs: 12 }} mt={1}>
              <FixedIncomeTable data={filteredData} />
            </Grid>
          </Grid>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FixedIncomePieChart data={filteredData} />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box borderBottom={1} borderColor="divider">
            <Tabs
              value={tabIndex}
              onChange={(_, newIndex) => setTabIndex(newIndex)}
              aria-label="Fixed Income Tabs"
            >
              <Tab label="Rentabilidade" />
              <Tab label="Proventos" />
            </Tabs>
          </Box>

          <Box mt={2}>
            {tabIndex === 0 && <PortfolioReturnsChart size={295} selectedCategory="Renda Fixa" />}
            {tabIndex === 1 && <FixedIncomeDividendsChart data={filteredDividends} />}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }} mt={1}>
          <Box display="flex" alignItems="left" mb={6} ml={5}>
            <Typography variant="h6">Evolução Patrimonial</Typography>
          </Box>
          <PortfolioPatrimonyChart
            patrimonyEvolution={patrimony}
            selected="Renda Fixa"
            size={300}
          />
        </Grid>
      </Grid>

      <Grid container direction="row" mt={2}>
        <Grid size={{ xs: 24 }}>
          <Paper variant="outlined">
            <Trades
              assetTypes={[
                ASSET_TYPES.CDB,
                ASSET_TYPES.DEB,
                ASSET_TYPES.CRI,
                ASSET_TYPES.CRA,
                ASSET_TYPES.TREASURY,
              ]}
              currencyId={1}
            />
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
