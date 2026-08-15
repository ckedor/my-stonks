import { syncBenchmarks } from '@/actions/portfolio'
import { fetchAssetAnalysis, fetchAssetDetails, fetchAssetReturns, recalculateAssetPosition } from '@/api/portfolio'
import AssetDetailPanelSkeleton from '@/components/AssetDetailPanelSkeleton'
import DividendForm from '@/components/DividendForm'
import DrawdownChart from '@/components/DrawdownChart'
import PortfolioDividendsChart from '@/components/PortfolioDividendsChart'
import AssetHeader from '@/components/asset/AssetHeader'
import BenchmarkComparison from '@/components/portfolio-asset/BenchmarkComparison'
import ChartSection from '@/components/portfolio-asset/ChartSection'
import PortfolioAssetChart from '@/components/portfolio-asset/PortfolioAssetChart'
import PortfolioAssetPatrimonyChart from '@/components/portfolio-asset/PortfolioAssetPatrimonyChart'
import type { PositionHistoryEntry, TradeEntry } from '@/components/portfolio-asset/helpers'
import RiskMetricsPanel from '@/components/RiskMetricsPanel'
import Trades from '@/components/Trades'
import { DIVIDEND_ROUTES, POSITION_ROUTES, TRANSACTION_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { formatFixedIncomeDescription, formatFixedIncomeFee } from '@/lib/utils/fixedIncome'
import { useDataCacheStore } from '@/stores/data-cache'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { Asset, AssetAnalysis, Dividend, ReturnsEntry } from '@/types'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import PaymentsIcon from '@mui/icons-material/Payments'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Snackbar, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

/** Tudo o que a página carrega de uma vez, sob uma chave de cache só, para o
 *  recálculo poder trocar o conjunto inteiro de forma atômica. */
interface AssetBundle {
  asset: Asset
  patrimony: any[]
  dividends: Dividend[]
  analysis: AssetAnalysis | null
  returns: ReturnsEntry[]
  history: PositionHistoryEntry[]
  trades: TradeEntry[]
}

/** Altura de todo gráfico da página.
 *
 *  O principal é mais alto porque carrega três modos e os marcadores de
 *  operação; os demais compartilham uma altura só, para as seções terem o mesmo
 *  peso ao rolar a página. */
const MAIN_CHART_HEIGHT = 420
const SECTION_CHART_HEIGHT = 320

type TabKey = 'visao-geral' | 'risco' | 'dividendos' | 'trades'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'visao-geral', label: 'Visão geral' },
  { key: 'risco', label: 'Risco' },
  { key: 'dividendos', label: 'Dividendos' },
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
  const [activeTab, setActiveTab] = useState<TabKey>('visao-geral')
  const [recalculating, setRecalculating] = useState(false)
  const [dividendFormOpen, setDividendFormOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const { openTradeForm } = useTradeFormStore()
  const { currency, format: formatCurrency, symbol: currencySymbol } = useCurrency()
  const positions = usePositionsStore((s) => s.positions)
  const benchmarks = useReturnsStore((s) => s.benchmarks)
  const formatRoundedCurrency = (value: number) =>
    formatCurrency(Math.round(value)).replace(/,\d{2}$/, '')

  const cacheKey = `asset-detail:${portfolioId}:${assetId}:${currency}`

  // Uma função só, usada pela carga inicial e pelo recálculo: eram dois blocos
  // idênticos, e cada requisição nova tinha de ser escrita duas vezes.
  const loadBundle = useCallback(async (): Promise<AssetBundle> => {
    const [asset, patrimonyRes, dividendRes, analysis, assetReturnsMap, historyRes, tradesRes] =
      await Promise.all([
        fetchAssetDetails(portfolioId, assetId, currency),
        api.get(POSITION_ROUTES.patrimonyEvolution(portfolioId), { params: { asset_id: assetId, currency } }),
        api.get(DIVIDEND_ROUTES.list, { params: { portfolio_id: portfolioId, asset_id: assetId, currency } }),
        fetchAssetAnalysis(portfolioId, assetId, currency),
        fetchAssetReturns(portfolioId, assetId, currency).catch(
          (): Record<string, ReturnsEntry[]> => ({}),
        ),
        api.get(POSITION_ROUTES.byPortfolio(portfolioId), {
          params: { most_recent: false, asset_id: assetId, currency },
        }),
        api.get(TRANSACTION_ROUTES.list, { params: { portfolio_id: portfolioId, asset_id: assetId } }),
      ])

    // O menu de ativos do gráfico da carteira se alimenta daqui: esta é a única
    // fonte de `assetReturns` no store, então a injeção continua mesmo agora
    // que a página do ativo não usa mais aquele gráfico.
    if (Object.keys(assetReturnsMap).length > 0) {
      useReturnsStore.getState().addAssetReturns(assetReturnsMap)
    }

    return {
      asset,
      patrimony: patrimonyRes.data,
      dividends: dividendRes.data,
      analysis,
      returns: assetReturnsMap[asset.ticker] ?? Object.values(assetReturnsMap)[0] ?? [],
      history: historyRes.data ?? [],
      trades: tradesRes.data ?? [],
    }
  }, [portfolioId, assetId, currency])

  const { data: assetBundle } = useCachedData<AssetBundle>(cacheKey, loadBundle, { enabled: true })

  // Os benchmarks vivem em um store próprio, alimentado pelas páginas da
  // carteira. Quem cai direto na página de um ativo também precisa deles, e a
  // ação é cacheada, então chamar aqui não custa uma requisição extra.
  useEffect(() => {
    syncBenchmarks()
  }, [])

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await recalculateAssetPosition(portfolioId, assetId)
      const fresh = await loadBundle()
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
  const assetReturns = assetBundle?.returns ?? []
  const history = assetBundle?.history ?? []
  const trades = assetBundle?.trades ?? []
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
  // Já em pontos percentuais: a análise da posição devolve assim.
  const cagr = analysis?.performance_metrics.cagr ?? null
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
      case 'visao-geral':
        return (
          <Box display="flex" flexDirection="column" gap={3}>
            <ChartSection>
              <PortfolioAssetChart
                history={history}
                trades={trades}
                returns={assetReturns}
                benchmarks={benchmarks}
                rollingCagr={analysis?.rolling_cagr}
                height={MAIN_CHART_HEIGHT}
                priceFormatter={formatCurrency}
                currencySymbol={currencySymbol}
                persistKey={`portfolio-asset:${asset.ticker}`}
              />
            </ChartSection>

            {analysis && Object.keys(analysis.performance_metrics.benchmarks_metrics).length > 0 && (
              <ChartSection title="Comparação com Benchmarks">
                <BenchmarkComparison metrics={analysis.performance_metrics.benchmarks_metrics} />
              </ChartSection>
            )}

            {asset.fixed_income && fixedIncomeDescription && (
              <ChartSection title="Renda Fixa">
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
              </ChartSection>
            )}

            <ChartSection title="Evolução Patrimonial">
              <PortfolioAssetPatrimonyChart
                data={patrimonyEvolution}
                height={SECTION_CHART_HEIGHT}
                currencySymbol={currencySymbol}
                persistKey={`portfolio-asset-patrimony:${asset.ticker}`}
              />
            </ChartSection>

          </Box>
        )
      case 'risco':
        return analysis ? (
          <Box display="flex" flexDirection="column" gap={3}>
            {/* Dois cards, e não um: juntos, o título interno do gráfico caía
                colado na última linha das métricas. */}
            <ChartSection title="Métricas de Risco">
              <RiskMetricsPanel analysis={analysis} />
            </ChartSection>

            <ChartSection>
              <DrawdownChart
                series={analysis.risk_metrics.drawdown.series}
                stats={analysis.risk_metrics.drawdown.stats}
                size={SECTION_CHART_HEIGHT}
              />
            </ChartSection>
          </Box>
        ) : (
          <EmptyTabContent label="Risco — dados não disponíveis" />
        )
      case 'dividendos':
        return (
          <ChartSection title="Dividendos">
            <PortfolioDividendsChart
              dividends={dividends}
              selected={'portfolio'}
              size={SECTION_CHART_HEIGHT}
            />
          </ChartSection>
        )
      case 'trades':
        return <Trades assetId={assetId} />
      default:
        return null
    }
  }

  return (
    <Box>
      {/* Sem borda inferior aqui: as abas logo abaixo já trazem a delas, e as
          duas juntas desenhavam duas linhas coladas. */}
      <Box sx={{ pb: 2.5 }}>
        <AssetHeader
          ticker={asset.ticker}
          name={asset.name}
          typeShortName={asset.asset_type?.short_name}
          marketHref={`/market/asset/${asset.id}`}
          action={assetSelector}
        />

        {/* A posição e o CAGR: quanto se tem, e a que ritmo isso cresceu. As
            demais medidas qualificam essas duas e ficam na linha abaixo. */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 2,
            mt: 3,
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              Posição
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1.25} sx={{ mt: 0.25 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                {formatRoundedCurrency(asset.value)}
              </Typography>
              {cagr != null && (
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 600, color: cagr >= 0 ? 'success.main' : 'error.main' }}
                >
                  {cagr >= 0 ? '+' : ''}
                  {cagr.toFixed(2).replace('.', ',')}% a.a.
                </Typography>
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
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
            <Tooltip title="Recalcular posição">
              {/* `span` porque um botão desabilitado não emite os eventos de
                  mouse que o tooltip escuta. */}
              <span>
                <IconButton
                  size="small"
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  aria-label="Recalcular posição"
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  {recalculating ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Dois grupos numa linha só, separados por uma régua: o que a posição
            é hoje, e o que ela rendeu. */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 2.5 }}
        >
          <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
            <MetricItem label="Preço atual" value={formatRoundedCurrency(asset.price)} />
            <MetricItem label="Preço médio" value={formatRoundedCurrency(asset.average_price)} />
            <MetricItem label="Quantidade" value={asset.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} />
            <MetricItem label="Peso" value={`${assetPct.toFixed(1).replace('.', ',')}%`} />
            {asset.fixed_income && fixedIncomeDescription && (
              <MetricItem label="Indexador" value={fixedIncomeDescription} />
            )}
          </Stack>

          <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
            <MetricItem label="12m" value={twelveReturn.text} color={twelveReturn.color} />
            <MetricItem label="Acumulado" value={accReturn.text} color={accReturn.color} />
          </Stack>
        </Stack>
      </Box>

      <Divider sx={{ mt: 2.5 }} />

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          // Sem borda inferior: a régua acima já separa as abas da ficha, e
          // uma segunda linha logo abaixo delas as encaixotaria. O indicador da
          // aba ativa é o que marca onde se está.
          minHeight: 40,
          '& .MuiTabs-indicator': { height: 2 },
          '& .MuiTab-root': {
            textTransform: 'none',
            minHeight: 40,
            fontWeight: 600,
            fontSize: '0.9rem',
            px: 0,
            mr: 3,
            minWidth: 0,
            color: 'text.secondary',
          },
          '& .MuiTab-root.Mui-selected': { color: 'text.primary' },
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
