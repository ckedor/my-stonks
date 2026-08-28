import { fetchSegmentAnalysis, fetchSegmentPatrimony, fetchSegmentReturns } from '@/api/portfolio'
import PortfolioSliceScreen from '@/components/portfolio-slice/PortfolioSliceScreen'
import PortfolioSliceScreenSkeleton from '@/components/portfolio-slice/PortfolioSliceScreenSkeleton'
import type { SliceTabId } from '@/components/portfolio-slice/tabs'
import { useAppTheme } from '@/components/ui'
import { PORTFOLIO_SEGMENTS, type PortfolioSegmentId } from '@/constants/portfolioSegments'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useTradesStore } from '@/stores/portfolio/trades'
import type { AssetAnalysis, PatrimonyEntry, PortfolioReturnEntry } from '@/types'
import { useCallback, useMemo, useState } from 'react'

interface Props {
  segment: PortfolioSegmentId
}

/** A carteira vista por um segmento — um tipo de ativo, num mercado.
 *
 *  Os cinco segmentos mostram a mesma tela, e é a mesma que uma categoria
 *  personalizada mostra: o que muda é só como o recorte é escolhido. Aqui ele
 *  vem carimbado em cada posição pelo backend, que é quem sabe separar a ação
 *  brasileira da estrangeira. */
export default function PortfolioSegmentPage({ segment }: Props) {
  const definition = PORTFOLIO_SEGMENTS[segment]

  const portfolioId = usePortfolioStore((state) => state.selectedPortfolio?.id)
  const positions = usePositionsStore((state) => state.positions)
  const positionsLoading = usePositionsStore((state) => state.loading) && positions.length === 0
  const dividends = useDividendsStore((state) => state.dividends)
  const trades = useTradesStore((state) => state.trades)
  const { currency } = useCurrency()
  const theme = useAppTheme()

  const [tab, setTab] = useState<SliceTabId>('rentabilidade')

  const segmentPositions = useMemo(
    () => positions.filter((position) => position.segment === segment),
    [positions, segment],
  )
  const assetIds = useMemo(
    () => segmentPositions.map((position) => position.asset_id),
    [segmentPositions],
  )

  const { data: segmentReturns, loading: returnsLoading } = useCachedData<PortfolioReturnEntry[]>(
    portfolioId ? `segment-returns:${portfolioId}:${segment}:${currency}` : null,
    useCallback(
      () => fetchSegmentReturns(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
  )

  const { data: analysis, loading: analysisLoading } = useCachedData<AssetAnalysis | null>(
    portfolioId ? `segment-analysis:${portfolioId}:${segment}:${currency}` : null,
    useCallback(
      () => fetchSegmentAnalysis(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
    { enabled: tab === 'risco' },
  )

  const { data: patrimony, loading: patrimonyLoading } = useCachedData<PatrimonyEntry[]>(
    portfolioId ? `segment-patrimony:${portfolioId}:${segment}:${currency}` : null,
    useCallback(
      () => fetchSegmentPatrimony(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
    { enabled: tab === 'patrimonio' },
  )

  const returns = useMemo(
    () => (segmentReturns ?? []).map((entry) => ({ date: entry.date, value: entry.acc_return })),
    [segmentReturns],
  )
  const externalSeries = useMemo(
    () => ({ key: segment, label: definition.label, data: returns, assetIds }),
    [segment, definition.label, returns, assetIds],
  )

  if (positionsLoading) return <PortfolioSliceScreenSkeleton titleWidth={180} description />
  if (!portfolioId) return null

  const portfolioValue = positions.reduce((sum, position) => sum + position.value, 0)

  return (
    <PortfolioSliceScreen
      portfolioId={portfolioId}
      title={definition.label}
      breadcrumbs={[
        { label: 'Carteira', href: '/portfolio/overview' },
        { label: definition.label },
      ]}
      description={definition.description}
      accentColor={theme.palette.primary.main}
      persistKey={`segment:${segment}`}
      positions={segmentPositions}
      portfolioValue={portfolioValue}
      dimensions={definition.dimensions}
      emptyMessage={`Nenhuma posição em ${definition.label} nesta carteira.`}
      returns={returns}
      returnsLoading={returnsLoading}
      benchmarks={definition.benchmarks}
      externalSeries={externalSeries}
      cagr={segmentReturns?.at(-1)?.cagr ?? null}
      analysis={analysis ?? null}
      analysisLoading={analysisLoading}
      patrimony={patrimony ?? []}
      patrimonyLoading={patrimonyLoading}
      patrimonySeriesKey={definition.label}
      patrimonyFromPortfolioColumn
      allDividends={dividends}
      dividendsChartSelection="portfolio"
      allTrades={trades}
      tab={tab}
      onTabChange={setTab}
    />
  )
}
