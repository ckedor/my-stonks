import {
  AppAlert,
  AppAutocomplete,
  AppButton,
  AppCard,
  AppChip,
  AppDivider,
  AppProgressBar,
  AppSimpleTable,
  AppStack,
  AppText,
  LoadingSpinner,
  PageTitle,
  SectionTitle,
} from '@/components/ui'
import {
  ASSET_ROUTES,
  PORTFOLIO_ROUTES,
  POSITION_CONSOLIDATOR_ROUTES,
  USER_ROUTES,
} from '@/constants/routes'
import api from '@/lib/api'
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

const STATE_TONE: Record<RunState, 'neutral' | 'info' | 'success' | 'danger'> = {
  pending: 'neutral',
  running: 'info',
  success: 'success',
  failure: 'danger',
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
    { severity: 'error' | 'success'; message: string } | null
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

  const userEmail = useCallback(
    (userId: number) => emailByUserId[userId] ?? `user #${userId}`,
    [emailByUserId],
  )

  const portfolioLabel = useCallback(
    (portfolio: PortfolioSummary) => `${portfolio.name} — ${userEmail(portfolio.user_id)}`,
    [userEmail],
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
  if (loadError) return <AppAlert severity="error">{loadError}</AppAlert>

  const finished = runs.filter((run) => run.state === 'success' || run.state === 'failure').length

  return (
    <AppStack gap="lg">
      <PageTitle>Consolidação</PageTitle>

      <AppCard padding="lg">
        <AppStack gap="md">
          <AppStack gap="xs">
            <SectionTitle>Recalcular todas as posições</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              Percorre as {portfolios.length} carteiras do app, uma de cada vez, recalculando todos
              os ativos com transação.
            </AppText>
          </AppStack>

          <AppStack align="start">
            <AppButton
              onClick={recalculateEveryPortfolio}
              disabled={runningAll || portfolios.length === 0}
            >
              {runningAll ? 'Recalculando…' : 'Recalcular todas as carteiras'}
            </AppButton>
          </AppStack>

          {runs.length > 0 && (
            <AppStack gap="md">
              <AppProgressBar value={(finished / runs.length) * 100} />
              <AppSimpleTable
                rows={runs}
                getRowKey={(run) => run.portfolio.id}
                columns={[
                  { label: 'Carteira', render: (run) => run.portfolio.name },
                  { label: 'Usuário', render: (run) => userEmail(run.portfolio.user_id) },
                  {
                    label: 'Status',
                    render: (run) => (
                      <AppChip
                        label={STATE_LABEL[run.state]}
                        tone={STATE_TONE[run.state]}
                        emphasis={run.state === 'pending' ? 'outline' : 'solid'}
                      />
                    ),
                  },
                  {
                    label: 'Erro',
                    render: (run) => (
                      <AppText variant="bodySmall" tone="danger">
                        {run.error ?? '—'}
                      </AppText>
                    ),
                  },
                ]}
              />
            </AppStack>
          )}
        </AppStack>
      </AppCard>

      <AppCard padding="lg">
        <AppStack gap="md">
          <AppStack gap="xs">
            <SectionTitle>Consolidar um ativo</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              Recalcula a posição de um único ativo numa única carteira.
            </AppText>
          </AppStack>

          <AppStack direction="row" gap="md" align="start" wrap>
            <AppAutocomplete
              options={portfolios}
              value={selectedPortfolio}
              onChange={setSelectedPortfolio}
              getOptionLabel={portfolioLabel}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              label="Carteira"
              size="sm"
            />
            <AppAutocomplete
              options={assets}
              value={selectedAsset}
              onChange={setSelectedAsset}
              getOptionLabel={assetLabel}
              filterOptions={filterAssets}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              label="Ativo"
            />
            <AppButton
              onClick={recalculateSingleAsset}
              disabled={assetRunning || !selectedPortfolio || !selectedAsset}
            >
              {assetRunning ? 'Consolidando…' : 'Consolidar'}
            </AppButton>
          </AppStack>

          {assetResult && <AppAlert severity={assetResult.severity}>{assetResult.message}</AppAlert>}

          <AppDivider />

          <AppStack gap="sm">
            <AppText variant="bodySmall" tone="secondary">
              {portfolios.length} carteiras no app
            </AppText>
            <AppSimpleTable
              rows={portfolios}
              getRowKey={(portfolio) => portfolio.id}
              columns={[
                { label: 'ID', render: (portfolio) => portfolio.id },
                { label: 'Carteira', render: (portfolio) => portfolio.name },
                { label: 'Usuário', render: (portfolio) => userEmail(portfolio.user_id) },
              ]}
            />
          </AppStack>
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
