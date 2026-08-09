import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ASSET_ROUTES,
  PORTFOLIO_ROUTES,
  POSITION_CONSOLIDATOR_ROUTES,
  USER_ROUTES,
} from '@/constants/routes'
import api from '@/lib/api'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'

const MAX_ASSET_OPTIONS_RENDERED = 100

interface PortfolioSummary {
  id: number
  name: string
  user_id: number
}

interface UserSummary {
  id: number
  email: string
}

interface AssetOption {
  id: number
  ticker: string | null
  name: string
}

type RunState = 'pending' | 'running' | 'success' | 'failure'

interface PortfolioRun {
  portfolio: PortfolioSummary
  state: RunState
  error?: string
}

const STATE_LABEL: Record<RunState, string> = {
  pending: 'Na fila',
  running: 'Rodando',
  success: 'OK',
  failure: 'Falhou',
}

const STATE_COLOR: Record<RunState, 'default' | 'info' | 'success' | 'error'> = {
  pending: 'default',
  running: 'info',
  success: 'success',
  failure: 'error',
}

function errorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { message?: string; detail?: string } } })
    ?.response?.data
  return detail?.message ?? detail?.detail ?? (error as Error)?.message ?? 'Erro desconhecido'
}

export default function AdminConsolidationPage() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [runs, setRuns] = useState<PortfolioRun[]>([])
  const [runningAll, setRunningAll] = useState(false)

  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioSummary | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [assetRunning, setAssetRunning] = useState(false)
  const [assetResult, setAssetResult] = useState<
    { severity: 'success' | 'error'; message: string } | null
  >(null)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get<PortfolioSummary[]>(PORTFOLIO_ROUTES.all),
      api.get<UserSummary[]>(USER_ROUTES.list),
      api.get<AssetOption[]>(ASSET_ROUTES.list),
    ])
      .then(([portfolioResponse, userResponse, assetResponse]) => {
        if (!active) return
        setPortfolios(portfolioResponse.data)
        setUsers(userResponse.data)
        setAssets(assetResponse.data)
      })
      .catch((error) => active && setLoadError(errorMessage(error)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const emailByUserId = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user.email])),
    [users],
  )

  const portfolioLabel = useCallback(
    (portfolio: PortfolioSummary) =>
      `${portfolio.name} — ${emailByUserId[portfolio.user_id] ?? `user #${portfolio.user_id}`}`,
    [emailByUserId],
  )

  const assetLabel = useCallback(
    (asset: AssetOption) => (asset.ticker ? `${asset.ticker} — ${asset.name}` : asset.name),
    [],
  )

  // 11k+ assets reach this selector, so cap what the dropdown renders per keystroke.
  const filterAssets = useMemo(
    () => (list: AssetOption[], state: { inputValue: string }) => {
      const query = state.inputValue.trim().toLowerCase()
      const matches = query
        ? list.filter((asset) => assetLabel(asset).toLowerCase().includes(query))
        : list
      return matches.slice(0, MAX_ASSET_OPTIONS_RENDERED)
    },
    [assetLabel],
  )

  const recalculateEveryPortfolio = async () => {
    setRunningAll(true)
    setRuns(portfolios.map((portfolio) => ({ portfolio, state: 'pending' })))

    // One portfolio at a time: each recalculation is heavy, and running them
    // in sequence keeps the per-portfolio outcome readable.
    for (const portfolio of portfolios) {
      setRuns((current) =>
        current.map((run) =>
          run.portfolio.id === portfolio.id ? { ...run, state: 'running' } : run,
        ),
      )
      try {
        await api.post(POSITION_CONSOLIDATOR_ROUTES.recalculateAllPosition(portfolio.id))
        setRuns((current) =>
          current.map((run) =>
            run.portfolio.id === portfolio.id ? { ...run, state: 'success' } : run,
          ),
        )
      } catch (error) {
        const message = errorMessage(error)
        setRuns((current) =>
          current.map((run) =>
            run.portfolio.id === portfolio.id
              ? { ...run, state: 'failure', error: message }
              : run,
          ),
        )
      }
    }
    setRunningAll(false)
  }

  const recalculateSingleAsset = async () => {
    if (!selectedPortfolio || !selectedAsset) return
    setAssetRunning(true)
    setAssetResult(null)
    try {
      await api.post(
        POSITION_CONSOLIDATOR_ROUTES.recalculateAssetPosition(selectedPortfolio.id),
        null,
        { params: { asset_id: selectedAsset.id } },
      )
      setAssetResult({
        severity: 'success',
        message: `${assetLabel(selectedAsset)} consolidado em ${portfolioLabel(selectedPortfolio)}.`,
      })
    } catch (error) {
      setAssetResult({ severity: 'error', message: errorMessage(error) })
    } finally {
      setAssetRunning(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return <Alert severity="error">{loadError}</Alert>

  const finished = runs.filter((run) => run.state === 'success' || run.state === 'failure').length

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Consolidação
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Recalcular todas as posições
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Percorre as {portfolios.length} carteiras do app, uma de cada vez, recalculando todos os
          ativos com transação.
        </Typography>

        <Button
          variant="contained"
          onClick={recalculateEveryPortfolio}
          disabled={runningAll || portfolios.length === 0}
        >
          {runningAll ? 'Recalculando…' : 'Recalcular todas as carteiras'}
        </Button>

        {runs.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress
              variant="determinate"
              value={(finished / runs.length) * 100}
              sx={{ mb: 2, borderRadius: 1 }}
            />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Carteira</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Erro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.portfolio.id} hover>
                      <TableCell>{run.portfolio.name}</TableCell>
                      <TableCell>
                        {emailByUserId[run.portfolio.user_id] ?? `user #${run.portfolio.user_id}`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATE_LABEL[run.state]}
                          color={STATE_COLOR[run.state]}
                          variant={run.state === 'pending' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'error.main', fontSize: 13 }}>
                        {run.error ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Consolidar um ativo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Recalcula a posição de um único ativo numa única carteira.
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          <Autocomplete
            options={portfolios}
            value={selectedPortfolio}
            onChange={(_, value) => setSelectedPortfolio(value)}
            getOptionLabel={portfolioLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Carteira" />}
            sx={{ width: { xs: '100%', md: 340 } }}
          />
          <Autocomplete
            options={assets}
            value={selectedAsset}
            onChange={(_, value) => setSelectedAsset(value)}
            getOptionLabel={assetLabel}
            filterOptions={filterAssets}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Ativo" />}
            sx={{ width: { xs: '100%', md: 420 } }}
          />
          <Button
            variant="contained"
            onClick={recalculateSingleAsset}
            disabled={assetRunning || !selectedPortfolio || !selectedAsset}
            sx={{ mt: { md: 1 } }}
          >
            {assetRunning ? 'Consolidando…' : 'Consolidar'}
          </Button>
        </Stack>

        {assetResult && (
          <Alert severity={assetResult.severity} sx={{ mt: 2 }}>
            {assetResult.message}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {portfolios.length} carteiras no app
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Carteira</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Usuário</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portfolios.map((portfolio) => (
                <TableRow key={portfolio.id} hover>
                  <TableCell>{portfolio.id}</TableCell>
                  <TableCell>{portfolio.name}</TableCell>
                  <TableCell>
                    {emailByUserId[portfolio.user_id] ?? `user #${portfolio.user_id}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
