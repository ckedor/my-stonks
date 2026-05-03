import { fetchAssetAnalysis, fetchAssetDetails, fetchAssetReturns, recalculateAssetPosition } from '@/api/portfolio'
import AssetAveragePriceChart from '@/components/AssetAveragePriceChart'
import AssetDetailPanelSkeleton from '@/components/AssetDetailPanelSkeleton'
import AssetDetailsCard from '@/components/AssetDetailsCard'
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
import { useDataCacheStore } from '@/stores/data-cache'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { Asset, AssetAnalysis, Dividend } from '@/types'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import PaymentsIcon from '@mui/icons-material/Payments'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, Box, Button, Chip, CircularProgress, Snackbar, Tab, Tabs, Typography } from '@mui/material'
import { useCallback, useState } from 'react'

type TabKey = 'rentabilidade' | 'risco' | 'patrimonio' | 'posicao' | 'impacto' | 'trades' | 'fundamentos'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'rentabilidade', label: 'Rentabilidade' },
  { key: 'risco', label: 'Risco' },
  { key: 'patrimonio', label: 'Patrimônio' },
  { key: 'posicao', label: 'Construção de Posição' },
  { key: 'impacto', label: 'Impacto na Carteira' },
  { key: 'trades', label: 'Trades' },
  { key: 'fundamentos', label: 'Fundamentos' },
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

interface AssetDetailPanelProps {
  assetId: number
  portfolioId: number
}

export default function AssetDetailPanel({ assetId, portfolioId }: AssetDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('rentabilidade')
  const [recalculating, setRecalculating] = useState(false)
  const [dividendFormOpen, setDividendFormOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const { openTradeForm } = useTradeFormStore()
  const { currency } = useCurrency()

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

  const asset = assetBundle?.asset
  const patrimonyEvolution = assetBundle?.patrimony ?? []
  const dividends = assetBundle?.dividends ?? []
  const analysis = assetBundle?.analysis ?? null

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'rentabilidade':
        return (
          <Box display="flex" flexDirection="column" gap={4}>
            {analysis && (
              <Box
                display="flex"
                flexWrap="wrap"
                gap={1}
                alignItems="center"
                sx={{
                  px: 1,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  mb: -2,
                }}
              >
                <Chip
                  label={`CAGR ${analysis.performance_metrics.cagr.toFixed(2)}%`}
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
                  <Box key={name} display="flex" alignItems="center" gap={0.5}>
                    <Chip
                      label={`α ${name} ${bm.alpha >= 0 ? '+' : ''}${bm.alpha.toFixed(2)}%`}
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
                    <Typography variant="caption" color="text.secondary">
                      β {bm.beta.toFixed(2)} · ρ {bm.correlation.toFixed(2)}
                    </Typography>
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
      case 'patrimonio':
        return (
          <Box display="flex" flexDirection="column" gap={4}>
            <PortfolioPatrimonyChart
              patrimonyEvolution={patrimonyEvolution}
              selected={'portfolio'}
              size={350}
              hideContributions
            />
            <PortfolioDividendsChart dividends={dividends} selected={'portfolio'} size={300} />
          </Box>
        )
      case 'posicao':
        return <AssetAveragePriceChart size={450} assetId={assetId} />
      case 'impacto':
        return <EmptyTabContent label="Impacto na Carteira" />
      case 'trades':
        return <Trades assetId={assetId} />
      case 'fundamentos':
        return <EmptyTabContent label="Fundamentos" />
      default:
        return null
    }
  }

  return (
    <Box display="flex" sx={{ height: '100vh' }}>
        <Box
          sx={{
            width: 440,
            minWidth: 360,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <AssetDetailsCard asset={asset} embedded analysis={analysis} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, px: 4, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={recalculating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleRecalculate}
              disabled={recalculating}
              sx={{ flex: 1, textTransform: 'none' }}
            >
              {recalculating ? 'Recalculando...' : 'Recalcular'}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddShoppingCartIcon />}
              onClick={handleBuy}
              sx={{ flex: 1, textTransform: 'none' }}
            >
              Comprar
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PaymentsIcon />}
              onClick={() => setDividendFormOpen(true)}
              sx={{ flex: 1, textTransform: 'none' }}
            >
              Provento
            </Button>
          </Box>
        </Box>

        {/* Right side: Tabs + Content */}
        <Box flex={1} minWidth={0} display="flex" flexDirection="column" sx={{ height: '100%' }}>
          {/* Tabs bar */}
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              minHeight: 42,
              '& .MuiTabs-flexContainer': {
                justifyContent: 'flex-end',
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                minHeight: 42,
                fontWeight: 500,
                fontSize: '0.85rem',
                py: 0,
              },
            }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.key} value={tab.key} label={tab.label} />
            ))}
          </Tabs>

          {/* Tab content */}
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {renderTabContent()}
          </Box>
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
