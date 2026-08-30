import { EMPTY_LIST } from '@/queries/empty'
import { useQuery } from '@tanstack/react-query'
import { useDividends, usePositions, useSelectedPortfolioId, useTrades } from '@/queries/portfolio'
import { fetchSegmentAnalysis, fetchSegmentPatrimony, fetchSegmentReturns } from '@/api/portfolio'
import PortfolioSliceScreen from '@/components/portfolio-slice/PortfolioSliceScreen'
import PortfolioSliceScreenSkeleton from '@/components/portfolio-slice/PortfolioSliceScreenSkeleton'
import type { SliceTabId } from '@/components/portfolio-slice/tabs'
import { useAppTheme } from '@/components/ui'
import { PORTFOLIO_SEGMENTS, type PortfolioSegmentId } from '@/constants/portfolioSegments'
import { useCurrency } from '@/hooks/useCurrency'
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

  const portfolioId = useSelectedPortfolioId()
  const positions = usePositions().data ?? EMPTY_LIST
  const positionsLoading = usePositions().isPending
  const dividends = useDividends().data ?? EMPTY_LIST
  const trades = useTrades().data ?? EMPTY_LIST
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

  const { data: segmentReturns, isPending: returnsLoading } = useQuery<PortfolioReturnEntry[]>({
    queryKey: [`segment-returns:${portfolioId}:${segment}:${currency}`],
    queryFn: useCallback(
      () => fetchSegmentReturns(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
    enabled: Boolean(portfolioId),
  })

  const { data: analysis, isPending: analysisLoading } = useQuery<AssetAnalysis | null>({
    queryKey: [portfolioId ? `segment-analysis:${portfolioId}:${segment}:${currency}` : null],
    queryFn: useCallback(
      () => fetchSegmentAnalysis(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
    enabled: (portfolioId ? `segment-analysis:${portfolioId}:${segment}:${currency}` : null) != null && tab === 'risco',
  })

  const { data: patrimony, isPending: patrimonyLoading } = useQuery<PatrimonyEntry[]>({
    queryKey: [portfolioId ? `segment-patrimony:${portfolioId}:${segment}:${currency}` : null],
    queryFn: useCallback(
      () => fetchSegmentPatrimony(portfolioId!, segment, currency),
      [portfolioId, segment, currency],
    ),
    enabled: (portfolioId ? `segment-patrimony:${portfolioId}:${segment}:${currency}` : null) != null && tab === 'patrimonio',
  })

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
