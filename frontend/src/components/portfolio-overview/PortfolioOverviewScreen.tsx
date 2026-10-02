import {
  AppCard,
  AppChartArea,
  AppGrid,
  AppGridItem,
  AppStack,
  AppTabs,
  AppToggleGroup,
  SectionTitle,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type {
  Dividend,
  PatrimonyEntry,
  PortfolioPositionEntry,
  ReturnsEntry,
  UserCategory,
} from '@/types'
import { useLayoutEffect, useRef, useState } from 'react'
import OverviewAportsChart from './OverviewAportsChart'
import OverviewDividendsChart from './OverviewDividendsChart'
import OverviewPatrimonyChart from './OverviewPatrimonyChart'
import OverviewReturnsChart from './OverviewReturnsChart'
import PortfolioStandingCard from './PortfolioStandingCard'
import PositionPieChart, { type CompositionGrouping } from './PositionPieChart'
import PositionTable from './PositionTable'

/* O dashboard da carteira, sem saber de onde vem o dado.
 *
 * A página (`pages/portfolio/overview`) busca, espera e decide o estado vazio;
 * esta tela só desenha o que recebe. O estúdio de temas do admin desenha a
 * mesma tela com uma carteira de mentira para testar um tema — e por ser a
 * mesma, o que se vê lá é o dashboard de verdade, e não uma imitação que
 * envelhece sozinha. Painel novo entra aqui, nunca na página. */

const OVERVIEW_PANEL_HEIGHT = 360

const COMPOSITION_GROUPINGS: { value: CompositionGrouping; label: string }[] = [
  { value: 'category', label: 'Categoria' },
  { value: 'asset', label: 'Ativo' },
]

type BottomTab = 'dividends' | 'patrimony' | 'aports'

const BOTTOM_TABS = [
  { id: 'dividends' as const, label: 'Proventos' },
  { id: 'patrimony' as const, label: 'Patrimônio' },
  { id: 'aports' as const, label: 'Aportes' },
]

export interface PortfolioOverviewData {
  positions: PortfolioPositionEntry[]
  /** As categorias da carteira, com a cor que o usuário deu a cada uma. */
  categories: Pick<UserCategory, 'name' | 'color'>[]
  patrimonyEvolution: PatrimonyEntry[]
  dividends: Dividend[]
  /** Retorno acumulado e CAGR da carteira (`portfolio`) e de cada categoria. */
  returnCurves: {
    series: Record<string, ReturnsEntry[]>
    cagr: Record<string, number | null>
    isPending?: boolean
  }
  benchmarks: Record<string, ReturnsEntry[]>
  /** CAGR do CDI no período da carteira, em %. */
  cdiCagr: number | null
}

export interface PortfolioOverviewScreenProps extends PortfolioOverviewData {
  onAssetSelect: (assetId: number) => void
}

export default function PortfolioOverviewScreen({
  positions,
  categories,
  patrimonyEvolution,
  dividends,
  returnCurves,
  benchmarks,
  cdiCagr,
  onAssetSelect,
}: PortfolioOverviewScreenProps) {
  const { format: formatCurrency } = useCurrency()

  const totalValue = positions.reduce((s, p) => s + p.value, 0)
  const cagrRaw = returnCurves.cagr['portfolio'] ?? null
  const cagr = cagrRaw != null ? cagrRaw * 100 : null
  const cdiPct = cagr != null && cdiCagr != null && cdiCagr !== 0 ? (cagr / cdiCagr) * 100 : null

  const [selectedCategory, setSelectedCategory] = useState<string>('portfolio')
  const [bottomTab, setBottomTab] = useState<BottomTab>('dividends')
  const [grouping, setGrouping] = useState<CompositionGrouping>('category')

  // The chart matches the height the category list has with its drawers closed.
  // Measured from the data, never from interaction, so expanding a category
  // grows the list without dragging the chart along with it. The screen only
  // mounts once the data is there, so measuring on mount and on a new
  // position count is enough.
  const positionListRef = useRef<HTMLDivElement>(null)
  const [chartHeight, setChartHeight] = useState(OVERVIEW_PANEL_HEIGHT)

  useLayoutEffect(() => {
    const node = positionListRef.current
    if (!node) return
    setChartHeight(Math.max(node.offsetHeight, OVERVIEW_PANEL_HEIGHT))
  }, [positions.length])

  return (
    <AppStack gap="lg">
      {/* O cabeçalho da carteira é o patrimônio, sem caixa em volta. */}
      <PortfolioStandingCard
        patrimony={totalValue}
        cagr={cagr}
        cdiPct={cdiPct}
        formatCurrency={formatCurrency}
      />

      {/* ── Linha 1: rentabilidade + composição ── */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Rentabilidade</SectionTitle>
              <OverviewReturnsChart
                categoryReturns={returnCurves.series}
                benchmarks={benchmarks}
                pending={returnCurves.isPending}
                size={OVERVIEW_PANEL_HEIGHT}
                selectedCategory={selectedCategory}
              />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard>
            <AppStack gap="sm">
              <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
                <SectionTitle>Composição</SectionTitle>
                <AppToggleGroup
                  label="Fatiar a composição por"
                  options={COMPOSITION_GROUPINGS}
                  value={grouping}
                  onChange={setGrouping}
                />
              </AppStack>
              <PositionPieChart
                positions={positions}
                categories={categories}
                height={OVERVIEW_PANEL_HEIGHT}
                selectedCategory={selectedCategory}
                grouping={grouping}
                onCategorySelect={setSelectedCategory}
                onAssetSelect={onAssetSelect}
              />
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      {/* ── Linha 2: categorias + proventos/patrimônio/aportes ── */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md" align="start">
        <AppGridItem span={{ xs: 1, lg: 5 }} ref={positionListRef}>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Categorias</SectionTitle>
              <PositionTable
                positions={positions}
                categories={categories}
                categoryCagr={returnCurves.cagr}
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
                onAssetSelect={onAssetSelect}
              />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          {/* A altura do card é a da lista ao lado, medida fechada; o gráfico
              ocupa o que sobra dentro dele. */}
          <AppCard height={chartHeight}>
            <AppChartArea
              height="100%"
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
                <OverviewDividendsChart dividends={dividends} selected={selectedCategory} size="100%" />
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
          </AppCard>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
