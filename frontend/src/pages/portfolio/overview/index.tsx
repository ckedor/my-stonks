import { EMPTY_LIST } from '@/queries/empty'
import { useAnalysis, useBenchmarks, useDividends, usePatrimony, usePositions, useReturnCurves, useWealthTier } from '@/queries/portfolio'
import { useCurrency } from '@/hooks/useCurrency'
import { useTradeFormStore } from '@/stores/trade-form'
import {
  AppButton,
  AppChartArea,
  AppEmptyState,
  AppGrid,
  AppGridItem,
  AppStack,
  AppTabs,
} from '@/components/ui'
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OverviewAportsChart from './OverviewAportsChart'
import OverviewDividendsChart from './OverviewDividendsChart'
import OverviewPatrimonyChart from './OverviewPatrimonyChart'
import OverviewReturnsChart from './OverviewReturnsChart'
import OverviewSkeleton from './OverviewSkeleton'
import PositionPieChart from './PositionPieChart'
import PositionTable from './PositionTable'
import PortfolioStandingCard from './PortfolioStandingCard'

const OVERVIEW_PANEL_HEIGHT = 360

type BottomTab = 'dividends' | 'patrimony' | 'aports'

const BOTTOM_TABS = [
  { id: 'dividends' as const, label: 'Proventos' },
  { id: 'patrimony' as const, label: 'Patrimônio' },
  { id: 'aports' as const, label: 'Aportes' },
]

export default function PortfolioOverviewPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const positionsQuery = usePositions()
  const patrimonyQuery = usePatrimony()
  const dividendsQuery = useDividends()
  const wealthTierQuery = useWealthTier()
  const benchmarksQuery = useBenchmarks()
  const analysisQuery = useAnalysis()
  const returnCurves = useReturnCurves()

  const positions = positionsQuery.data ?? EMPTY_LIST
  const patrimonyEvolution = patrimonyQuery.data ?? EMPTY_LIST
  const dividends = dividendsQuery.data ?? EMPTY_LIST
  const categoryCagr = returnCurves.cagr
  const wealthTierStanding = wealthTierQuery.data ?? null
  const analysis = analysisQuery.data
  const { format: formatCurrency } = useCurrency()

  const totalValue = positions.reduce((s, p) => s + p.value, 0)
  const cagrRaw = categoryCagr['portfolio'] ?? null
  const cagr = cagrRaw != null ? cagrRaw * 100 : null
  const cdiMetrics = analysis?.performance_metrics?.benchmarks_metrics?.['CDI']
  const cdiCagr = cdiMetrics?.cagr
  const cdiPct = cagr != null && cdiCagr != null && cdiCagr !== 0
    ? ((cagr / cdiCagr) * 100)
    : null

  /* A tela inteira aparece de uma vez.
   *
   * Antes o portão olhava só posições e séries, e o resto entrava conforme
   * chegava: o cabeçalho e as listas pintavam primeiro e o gráfico de
   * rentabilidade ficava sozinho no esqueleto, o que se lê como travamento e
   * não como carregamento. Enquanto qualquer uma das buscas da página não
   * respondeu, o que se vê é o esqueleto dela — e com a cache quente nenhuma
   * está pendente, então a página abre montada. */
  const loading =
    positionsQuery.isPending ||
    patrimonyQuery.isPending ||
    dividendsQuery.isPending ||
    wealthTierQuery.isPending ||
    benchmarksQuery.isPending ||
    analysisQuery.isPending ||
    returnCurves.isPending

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [bottomTab, setBottomTab] = useState<BottomTab>('dividends')

  // The chart matches the height the category list has with its drawers closed.
  // Measured from the data, never from interaction, so expanding a category
  // grows the list without dragging the chart along with it.
  //
  // `loading` is a dependency because of the early return below: while it is
  // true the page renders the skeleton and the ref points at nothing. The list
  // arriving is not what puts it on screen — leaving the loading state is, and
  // with the query cache warm the positions are already there by then, so
  // `positions.length` alone never changes again and the measure never runs.
  const positionListRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(OVERVIEW_PANEL_HEIGHT)

  useLayoutEffect(() => {
    const node = positionListRef.current
    if (!node) return
    setChartHeight(Math.max(node.offsetHeight, OVERVIEW_PANEL_HEIGHT))
  }, [positions.length, loading])

  if (loading) {
    return <OverviewSkeleton />
  }

  if (!loading && positions.length === 0) {
    return (
      <AppEmptyState
        title="Sua carteira ainda está vazia"
        description="Comece cadastrando sua primeira compra"
        action={<AppButton onClick={() => openTradeForm()}>Cadastrar Primeira Compra</AppButton>}
      />
    )
  }

  return (
    <AppStack gap="lg">
      {/* ── Hero: patrimônio e patente, um bloco só ── */}
      {/* A arte do personagem não mora aqui: ela vive no pé da coluna de
          navegação, onde tem largura fixa e não disputa espaço com o gráfico. */}
      <PortfolioStandingCard
        patrimony={totalValue}
        cagr={cagr}
        cdiPct={cdiPct}
        standing={wealthTierStanding}
        formatCurrency={formatCurrency}
      />

      {/* ── Linha 1: rentabilidade (70%) + pizza (30%) ── */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <OverviewReturnsChart size={OVERVIEW_PANEL_HEIGHT} selectedCategory={selectedCategory} />
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <PositionPieChart
            positions={positions}
            height={OVERVIEW_PANEL_HEIGHT}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
          />
        </AppGridItem>
      </AppGrid>

      {/* ── Linha 2: lista de categorias + aba de proventos/patrimônio/aportes ── */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md" align="start">
        <AppGridItem span={{ xs: 1, lg: 5 }} ref={positionListRef}>
          <PositionTable
            positions={positions}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
          />
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppChartArea
            height={chartHeight}
            sizing="frame"
            toolbar={
              <AppTabs
                items={BOTTOM_TABS}
                value={bottomTab}
                onChange={setBottomTab}
                label="Séries da carteira"
              />
            }
          >
            {bottomTab === 'dividends' && (
              <OverviewDividendsChart
                dividends={dividends}
                selected={selectedCategory}
                size="100%"
              />
            )}
            {bottomTab === 'patrimony' && (
              <OverviewPatrimonyChart
                patrimonyEvolution={patrimonyEvolution}
                selected={selectedCategory}
                size="100%"
              />
            )}
            {bottomTab === 'aports' && (
              <OverviewAportsChart patrimonyEvolution={patrimonyEvolution} size="100%" />
            )}
          </AppChartArea>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
