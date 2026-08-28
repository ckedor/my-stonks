import { syncBenchmarks } from '@/actions/portfolio'
import { fetchAssetAnalysis, fetchAssetDetails, fetchAssetReturns, recalculateAssetPosition } from '@/api/portfolio'
import AssetDetailPanelSkeleton from '@/components/AssetDetailPanelSkeleton'
import DividendForm from '@/components/DividendForm'
import PortfolioDividendsChart from '@/components/PortfolioDividendsChart'
import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import AssetHeader from '@/components/asset/AssetHeader'
import BenchmarkComparison from '@/components/portfolio-asset/BenchmarkComparison'
import ChartSection from '@/components/portfolio-asset/ChartSection'
import PortfolioAssetChart from '@/components/portfolio-asset/PortfolioAssetChart'
import PortfolioAssetPatrimonyChart from '@/components/portfolio-asset/PortfolioAssetPatrimonyChart'
import type { PositionHistoryEntry, TradeEntry } from '@/components/portfolio-asset/helpers'
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
import {
    AppButton,
    AppDivider,
    AppGrid,
    AppIconButton,
    AppMetric,
    AppSnackbar,
    AppStack,
    AppTabs,
    AppText,
    AppTooltip,
    LoadingSpinner,
} from '@/components/ui'
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
    <AppStack align="center" justify="center">
      <AppText tone="secondary">{label} — em breve</AppText>
    </AppStack>
  )
}

type ReturnTone = 'default' | 'secondary' | 'success' | 'danger'

function formatReturn(value: number | null | undefined): { text: string; tone: ReturnTone } {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { text: '—', tone: 'secondary' }
  }

  const pct = Number(value) * 100
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`,
    tone: pct > 0 ? 'success' : pct < 0 ? 'danger' : 'default',
  }
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
  }, [currency])

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
    return <AppText>Ativo não encontrado.</AppText>
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
          <AppStack gap="lg">
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
                <AppGrid cols={{ xs: 1, sm: 4 }} gap="md">
                  <AppMetric label="Tipo RF" value={fixedIncomeDescription} />
                  {asset.fixed_income.index?.name && <AppMetric label="Índice" value={asset.fixed_income.index.name} />}
                  {asset.fixed_income.fee != null && <AppMetric label="Taxa" value={formatFixedIncomeFee(asset.fixed_income.fee)} />}
                  {asset.fixed_income.maturity_date && <AppMetric label="Vencimento" value={String(asset.fixed_income.maturity_date)} />}
                </AppGrid>
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
          </AppStack>
        )
      case 'risco':
        return analysis ? (
          <RiskAnalysisCards analysis={analysis} drawdownSize={SECTION_CHART_HEIGHT} />
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
        return (
          <ChartSection>
            <Trades assetId={assetId} />
          </ChartSection>
        )
      default:
        return null
    }
  }

  return (
    <AppStack gap="lg">
      <AppStack gap="lg">
        <AssetHeader
          ticker={asset.ticker}
          name={asset.name}
          typeShortName={asset.asset_type?.short_name}
          marketHref={`/market/asset/${asset.id}`}
          action={assetSelector}
        />

        {/* A posição e o CAGR: quanto se tem, e a que ritmo isso cresceu. As
            demais medidas qualificam essas duas e ficam na linha abaixo. */}
        <AppStack direction="row" justify="between" align="end" gap="md" wrap>
          <AppMetric
            label="Posição"
            value={formatRoundedCurrency(asset.value)}
            size="lg"
            suffix={
              cagr != null && (
                <AppText weight="strong" tone={cagr >= 0 ? 'success' : 'danger'} inline>
                  {cagr >= 0 ? '+' : ''}
                  {cagr.toFixed(2).replace('.', ',')}% a.a.
                </AppText>
              )
            }
          />

          <AppStack direction="row" gap="sm" align="center">
            <AppButton size="sm" icon={<AddShoppingCartIcon />} onClick={handleBuy}>
              Comprar
            </AppButton>
            <AppButton
              size="sm"
              emphasis="outline"
              icon={<PaymentsIcon />}
              onClick={() => setDividendFormOpen(true)}
            >
              Provento
            </AppButton>
            <AppTooltip title="Recalcular posição">
              <AppIconButton
                label="Recalcular posição"
                size="sm"
                bordered
                disabled={recalculating}
                onClick={handleRecalculate}
              >
                {recalculating ? <LoadingSpinner /> : <RefreshIcon fontSize="small" />}
              </AppIconButton>
            </AppTooltip>
          </AppStack>
        </AppStack>

        {/* Dois grupos numa linha só, separados por uma régua: o que a posição
            é hoje, e o que ela rendeu. */}
        <AppStack direction="row" gap="lg" collapseBelow="sm" align="center" wrap>
          <AppStack direction="row" gap="lg" wrap>
            <AppMetric label="Preço atual" value={formatRoundedCurrency(asset.price)} />
            <AppMetric label="Preço médio" value={formatRoundedCurrency(asset.average_price)} />
            <AppMetric label="Quantidade" value={asset.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} />
            <AppMetric label="Peso" value={`${assetPct.toFixed(1).replace('.', ',')}%`} />
            {asset.fixed_income && fixedIncomeDescription && (
              <AppMetric label="Indexador" value={fixedIncomeDescription} />
            )}
          </AppStack>

          <AppDivider orientation="vertical" hideBelow="sm" />

          <AppStack direction="row" gap="lg" wrap>
            <AppMetric label="12m" value={twelveReturn.text} tone={twelveReturn.tone} />
            <AppMetric label="Acumulado" value={accReturn.text} tone={accReturn.tone} />
          </AppStack>
        </AppStack>
      </AppStack>

      <AppDivider />

      <AppTabs
        label="Seções do ativo"
        items={TABS.map((tab) => ({ id: tab.key, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      {renderTabContent()}

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />

      <DividendForm
        open={dividendFormOpen}
        onClose={() => setDividendFormOpen(false)}
        initialAsset={asset}
      />
    </AppStack>
  )
}
