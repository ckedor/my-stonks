import { useCurrency } from '@/hooks/useCurrency'
import { useAnalysisStore } from '@/stores/portfolio/analysis'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradeFormStore } from '@/stores/trade-form'
import { useWealthTierStore } from '@/stores/portfolio/wealth-tier'
import {
  AppButton,
  AppChartArea,
  AppEmptyState,
  AppGrid,
  AppGridItem,
  AppIllustration,
  AppPageHeader,
  AppStack,
  AppStackItem,
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
/* Só o padrão de quem ainda não tem altura própria cadastrada. A altura real e
   o ajuste vertical são por arte, no CRUD de patentes. */
const TIER_ARTWORK_HEIGHT = 220
/* Onde o bloco de patrimônio termina e a arte começa. */
const STANDING_CARD_WIDTH = 320

type BottomTab = 'dividends' | 'patrimony' | 'aports'

const BOTTOM_TABS = [
  { id: 'dividends' as const, label: 'Proventos' },
  { id: 'patrimony' as const, label: 'Patrimônio' },
  { id: 'aports' as const, label: 'Aportes' },
]

export default function PortfolioOverviewPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const positions = usePositionsStore(s => s.positions)
  const positionsLoading = usePositionsStore(s => s.loading)
  const patrimonyEvolution = usePatrimonyStore(s => s.patrimony)
  const dividends = useDividendsStore(s => s.dividends)
  const returnsLoading = useReturnsStore(s => s.loading)
  const categoryCagr = useReturnsStore(s => s.categoryCagr)

  const wealthTierStanding = useWealthTierStore(s => s.standing)
  const tier = wealthTierStanding?.current_tier ?? null

  const { analysis } = useAnalysisStore()
  const { format: formatCurrency } = useCurrency()

  const totalValue = positions.reduce((s, p) => s + p.value, 0)
  const cagrRaw = categoryCagr['portfolio'] ?? null
  const cagr = cagrRaw != null ? cagrRaw * 100 : null
  const cdiMetrics = analysis?.performance_metrics?.benchmarks_metrics?.['CDI']
  const cdiCagr = cdiMetrics?.cagr
  const cdiPct = cagr != null && cdiCagr != null && cdiCagr !== 0
    ? ((cagr / cdiCagr) * 100)
    : null

  const hasCagr = Object.keys(categoryCagr).length > 0
  const loading = (positionsLoading && positions.length === 0) || (returnsLoading && !hasCagr)

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [bottomTab, setBottomTab] = useState<BottomTab>('dividends')

  // The chart matches the height the category list has with its drawers closed.
  // Measured from the data, never from interaction, so expanding a category
  // grows the list without dragging the chart along with it.
  const positionListRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(OVERVIEW_PANEL_HEIGHT)

  useLayoutEffect(() => {
    const node = positionListRef.current
    if (!node) return
    setChartHeight(Math.max(node.offsetHeight, OVERVIEW_PANEL_HEIGHT))
  }, [positions.length])

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
      <AppPageHeader title="Resumo" />

      {/* ── Hero: patrimônio e patente, um bloco só ── */}
      {/* A arte fica à direita do bloco e fora do fluxo: assim ela desce sobre
          o gráfico pelo `artwork_offset` sem empurrar nada, e a altura da faixa
          continua sendo a do texto. */}
      <AppStack anchor>
        <AppStackItem width={STANDING_CARD_WIDTH}>
          <PortfolioStandingCard
            patrimony={totalValue}
            cagr={cagr}
            cdiPct={cdiPct}
            standing={wealthTierStanding}
            formatCurrency={formatCurrency}
          />
        </AppStackItem>

        {tier?.artwork && (
          <AppIllustration
            src={tier.artwork}
            height={tier.artwork_height ?? TIER_ARTWORK_HEIGHT}
            pinned={{ left: STANDING_CARD_WIDTH, top: tier.artwork_offset }}
          />
        )}
      </AppStack>

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
