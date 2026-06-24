import { fetchAssetAnalysis, fetchAssetDetails, fetchAssetReturns, recalculateAssetPosition } from '@/api/portfolio'
import AssetAveragePriceChart from '@/components/AssetAveragePriceChart'
import AssetDetailPanelSkeleton from '@/components/AssetDetailPanelSkeleton'
import DividendForm from '@/components/DividendForm'
import DrawdownChart from '@/components/DrawdownChart'
import PortfolioDividendsChart from '@/components/PortfolioDividendsChart'
import PortfolioPatrimonyChart from '@/components/PortfolioPatrimonyChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import RiskMetricsPanel from '@/components/RiskMetricsPanel'
import RollingCagrChart from '@/components/RollingCagrChart'
import Trades from '@/components/Trades'
import { DIVIDEND_ROUTES, POSITION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { formatFixedIncomeDescription, formatFixedIncomeFee } from '@/lib/utils/fixedIncome'
import { useDataCacheStore } from '@/stores/data-cache'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { Asset, AssetAnalysis, Dividend } from '@/types'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import PaymentsIcon from '@mui/icons-material/Payments'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material'
import { type ReactNode, useCallback, useState } from 'react'

type TabKey = 'rentabilidade' | 'risco' | 'posicao' | 'trades'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'rentabilidade', label: 'Rentabilidade' },
  { key: 'risco', label: 'Risco' },
  { key: 'posicao', label: 'Posição' },
  { key: 'trades', label: 'Trades' },
]

function EmptyTabContent({ label }: { label: string }) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height={400}
    >
      <Typography variant="subtitle1" color="text.secondary">
        {label} — em breve
      </Typography>
    </Box>
  )
}

function formatReturn(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { text: '—', color: 'text.secondary' }
  }

  const pct = Number(value) * 100
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`,
    color: pct > 0 ? 'success.main' : pct < 0 ? 'error.main' : 'text.primary',
  }
}

function formatMetricPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function MetricItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <Box sx={{ minWidth: { xs: 128, sm: 'auto' } }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 700, color: color ?? 'text.primary', lineHeight: 1.35 }}>
        {value}
      </Typography>
    </Box>
  )
}

interface AssetDetailPanelProps {
  assetId: number
  portfolioId: number
  assetSelector?: ReactNode
}

export default function AssetDetailPanel({ assetId, portfolioId, assetSelector }: AssetDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('rentabilidade')
  const [recalculating, setRecalculating] = useState(false)
  const [dividendFormOpen, setDividendFormOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const { openTradeForm } = useTradeFormStore()
  const { currency, format: formatCurrency } = useCurrency()
  const positions = usePositionsStore((s) => s.positions)
  const formatRoundedCurrency = (value: number) =>
    formatCurrency(Math.round(value)).replace(/,\d{2}$/, '')

  const cacheKey = `asset-detail:${portfolioId}:${assetId}:${currency}`

  const fetcher = useCallback(async () => {
    const [asset, patrimonyRes, dividendRes, analysis, assetReturnsMap] = await Promise.all([
      fetchAssetDetails(portfolioId, assetId, currency),
      api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId), { params: { asset_id: assetId, currency } }),
      api.get(DIVIDEND_ROUTES.list, { params: { portfolio_id: portfolioId, asset_id: assetId, currency } }),
      fetchAssetAnalysis(portfolioId, assetId, currency),
      fetchAssetReturns(portfolioId, assetId, currency).catch(() => ({})),
    ])
    if (Object.keys(assetReturnsMap).length > 0) {
      useReturnsStore.getState().addAssetReturns(assetReturnsMap)
    }
    return {
      asset,
      patrimony: patrimonyRes.data,
      dividends: dividendRes.data,
      analysis,
    }
  }, [portfolioId, assetId, currency])

  const { data: assetBundle } = useCachedData<{ asset: Asset; patrimony: any[]; dividends: Dividend[]; analysis: AssetAnalysis | null }>(
    cacheKey,
    fetcher,
    { enabled: true },
  )

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await recalculateAssetPosition(portfolioId, assetId)
      // Fetch all data without intermediate store updates
      const [freshAsset, patrimonyRes, dividendRes, freshAnalysis, assetReturnsMap] = await Promise.all([
        fetchAssetDetails(portfolioId, assetId, currency),
        api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId), { params: { asset_id: assetId, currency } }),
        api.get(DIVIDEND_ROUTES.list, { params: { portfolio_id: portfolioId, asset_id: assetId, currency } }),
        fetchAssetAnalysis(portfolioId, assetId, currency),
        fetchAssetReturns(portfolioId, assetId, currency).catch(() => ({})),
      ])
      const fresh = { asset: freshAsset, patrimony: patrimonyRes.data, dividends: dividendRes.data, analysis: freshAnalysis }
      // Batch all store + state updates together
      if (Object.keys(assetReturnsMap).length > 0) {
        useReturnsStore.getState().addAssetReturns(assetReturnsMap)
      }
      useDataCacheStore.getState().setData(cacheKey, fresh)
      setRecalculating(false)
      setSnackbar({ open: true, message: 'Posição recalculada com sucesso.', severity: 'success' })
    } catch (err) {
      console.error(err)
      setRecalculating(false)
      setSnackbar({ open: true, message: 'Erro ao recalcular posição.', severity: 'error' })
    }
  }

  const handleBuy = () => {
    if (!asset) return
    openTradeForm({
      id: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      asset_type_id: asset.asset_type?.id ?? 0,
    })
  }

  const formatSignedPercent = (value: number) => (
    `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`
  )

  const asset = assetBundle?.asset
  const patrimonyEvolution = assetBundle?.patrimony ?? []
  const dividends = assetBundle?.dividends ?? []
  const analysis = assetBundle?.analysis ?? null
  const totalPortfolioValue = positions.reduce((sum, position) => sum + position.value, 0)
  const assetPct = totalPortfolioValue > 0 && asset ? (asset.value / totalPortfolioValue) * 100 : 0

  if (!assetBundle) {
    return <AssetDetailPanelSkeleton />
  }

  if (!asset) {
    return (
      <Box p={4}>
        <Typography>Ativo não encontrado.</Typography>
      </Box>
    )
  }

  const accReturn = formatReturn(asset.acc_return)
  const twelveReturn = formatReturn(asset.twelve_months_return)
  const cagr = analysis?.performance_metrics.cagr ?? asset.cagr
  const maxDrawdown = analysis?.risk_metrics.drawdown.stats.max_drawdown
  const fixedIncomeDescription = asset.fixed_income
    ? formatFixedIncomeDescription({
        typeName: asset.fixed_income.fixed_income_type?.name,
        typeId: asset.fixed_income.fixed_income_type_id,
        indexName: asset.fixed_income.index?.short_name ?? asset.fixed_income.index?.name,
        fee: asset.fixed_income.fee,
      })
    : ''

  const renderTabContent = () => {
    switch (activeTab) {
      case 'rentabilidade':
        return (
          <Box display="flex" flexDirection="column" gap={4}>
            {analysis && (
              <Box
                display="flex"
                flexWrap="wrap"
                gap={0.75}
                alignItems="center"
                sx={{ mb: -2 }}
              >
                <Chip
                  label={`CAGR ${formatSignedPercent(analysis.performance_metrics.cagr)}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    color: analysis.performance_metrics.cagr >= 0 ? 'success.main' : 'error.main',
                    bgcolor: 'transparent',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
                {Object.entries(analysis.performance_metrics.benchmarks_metrics).map(([name, bm]) => (
                  <Box key={name} display="flex" alignItems="center" gap={0.75}>
                    <Chip
                      label={`α ${name} ${formatSignedPercent(bm.alpha)}`}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: bm.alpha >= 0 ? 'success.main' : 'error.main',
                        bgcolor: 'transparent',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    <Chip
                      label={`β ${name} ${bm.beta.toFixed(2)}`}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        bgcolor: 'transparent',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}

            <PortfolioReturnsChart
              size={350}
              selectedAssets={[asset.ticker]}
              selectedBenchmark={'CDI'}
            />
            {analysis?.rolling_cagr && analysis.rolling_cagr.length > 0 && (
              <RollingCagrChart data={analysis.rolling_cagr} size={280} />
            )}
          </Box>
        )
      case 'risco':
        return analysis ? (
          <Box display="flex" flexDirection="column" gap={3}>
            <RiskMetricsPanel analysis={analysis} />
            <DrawdownChart
              series={analysis.risk_metrics.drawdown.series}
              stats={analysis.risk_metrics.drawdown.stats}
              size={300}
            />
          </Box>
        ) : (
          <EmptyTabContent label="Risco — dados não disponíveis" />
        )
      case 'posicao':
        return (
          <Box display="flex" flexDirection="column" gap={4}>
            <AssetAveragePriceChart size={420} assetId={assetId} />
            {asset.fixed_income && fixedIncomeDescription && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, minmax(130px, 1fr))' },
                  gap: 2,
                  maxWidth: 820,
                }}
              >
                <MetricItem label="Tipo RF" value={fixedIncomeDescription} />
                {asset.fixed_income.index?.name && <MetricItem label="Índice" value={asset.fixed_income.index.name} />}
                {asset.fixed_income.fee != null && <MetricItem label="Taxa" value={formatFixedIncomeFee(asset.fixed_income.fee)} />}
                {asset.fixed_income.maturity_date && <MetricItem label="Vencimento" value={String(asset.fixed_income.maturity_date)} />}
              </Box>
            )}
            <PortfolioPatrimonyChart
              patrimonyEvolution={patrimonyEvolution}
              selected={'portfolio'}
              size={320}
              hideContributions
            />
            <PortfolioDividendsChart dividends={dividends} selected={'portfolio'} size={280} />
          </Box>
        )
      case 'trades':
        return <Trades assetId={assetId} />
      default:
        return null
    }
  }

  return (
    <Box>
      <Box
        sx={{
          pb: 2.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
            gap: { xs: 2, md: 4 },
            alignItems: 'start',
          }}
        >
          <Box minWidth={0} maxWidth={720}>
            <Typography variant="h3" sx={{ fontWeight: 760, lineHeight: 1, mb: 1 }}>
              {asset.ticker}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body1" color="text.secondary" sx={{ mr: 0.5 }}>
                {asset.name}
              </Typography>
              <Chip label={asset.asset_type?.short_name} size="small" variant="outlined" />
              <Chip label={asset.asset_type?.asset_class?.name} size="small" sx={{ bgcolor: 'action.hover' }} />
            </Stack>
          </Box>
          {assetSelector && (
            <Box sx={{ justifySelf: { xs: 'start', md: 'end' } }}>
              {assetSelector}
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
            gap: 2,
            alignItems: 'end',
            mt: 3,
          }}
        >
          <Stack
            direction="row"
            spacing={{ xs: 2, md: 3 }}
            useFlexGap
            flexWrap="wrap"
            sx={{ maxWidth: 1180 }}
          >
            <MetricItem label="Posição" value={formatRoundedCurrency(asset.value)} />
            {asset.fixed_income && fixedIncomeDescription && (
              <MetricItem label="Indexador" value={fixedIncomeDescription} />
            )}
            <MetricItem label="Quantidade" value={asset.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} />
            <MetricItem label="Preço atual" value={formatRoundedCurrency(asset.price)} />
            <MetricItem label="Preço médio" value={formatRoundedCurrency(asset.average_price)} />
            <MetricItem label="Peso" value={`${assetPct.toFixed(1).replace('.', ',')}%`} />
            <MetricItem label="12m" value={twelveReturn.text} color={twelveReturn.color} />
            <MetricItem label="CAGR" value={formatMetricPercent(cagr)} color={cagr != null && cagr > 0 ? 'success.main' : cagr != null && cagr < 0 ? 'error.main' : undefined} />
            <MetricItem label="Acumulado" value={accReturn.text} color={accReturn.color} />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddShoppingCartIcon />}
              onClick={handleBuy}
              sx={{ textTransform: 'none' }}
            >
              Comprar
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PaymentsIcon />}
              onClick={() => setDividendFormOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              Provento
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={recalculating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleRecalculate}
              disabled={recalculating}
              sx={{ textTransform: 'none' }}
            >
              {recalculating ? 'Recalculando...' : 'Recalcular'}
            </Button>
          </Stack>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mt: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 44,
          '& .MuiTab-root': {
            textTransform: 'none',
            minHeight: 44,
            fontWeight: 600,
            fontSize: '0.9rem',
            px: 2,
          },
        }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.key} value={tab.key} label={tab.label} />
        ))}
      </Tabs>

      <Box sx={{ py: 3 }}>
        {renderTabContent()}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <DividendForm
        open={dividendFormOpen}
        onClose={() => setDividendFormOpen(false)}
        initialAsset={asset}
      />
    </Box>
  )
}
