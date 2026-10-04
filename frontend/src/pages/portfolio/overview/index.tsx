import { useState } from 'react'
import PortfolioOverviewScreen from '@/components/portfolio-overview/PortfolioOverviewScreen'
import { AppAlert, AppButton, AppEmptyState } from '@/components/ui'
import { EMPTY_LIST, EMPTY_MAP } from '@/queries/empty'
import {
  useCdiCagr,
  useBenchmarks,
  useDividends,
  usePatrimony,
  usePositions,
  useReturnCurves,
  useSelectedPortfolio,
} from '@/queries/portfolio'
import { useTradeFormStore } from '@/stores/trade-form'
import { useNavigate } from 'react-router-dom'
import OverviewSkeleton from './OverviewSkeleton'

/* A página busca, espera e decide o vazio; o desenho é da
 * `PortfolioOverviewScreen`, que o estúdio de temas também usa. */
export default function PortfolioOverviewPage() {
  const navigate = useNavigate()
  const { openTradeForm } = useTradeFormStore()

  const portfolio = useSelectedPortfolio()
  const positionsQuery = usePositions()
  const [patrimonyPortfolioId, setPatrimonyPortfolioId] = useState<number>()
  const patrimonyQuery = usePatrimony(undefined, portfolio != null && patrimonyPortfolioId === portfolio.id)
  const dividendsQuery = useDividends()
  const benchmarksQuery = useBenchmarks()
  const cdiCagrQuery = useCdiCagr()
  const returnCurves = useReturnCurves()

  const positions = positionsQuery.data ?? EMPTY_LIST

  // Posições bastam para o patrimônio atual, a composição e as categorias.
  // Cada gráfico reserva seu próprio espaço enquanto a série chega.
  if (positionsQuery.isPending) {
    return <OverviewSkeleton />
  }

  if (positionsQuery.isError && !positionsQuery.data) {
    return <AppAlert tone="danger">Não foi possível carregar sua carteira.</AppAlert>
  }

  if (positions.length === 0) {
    return (
      <AppEmptyState
        title="Sua carteira ainda está vazia"
        description="Comece cadastrando sua primeira compra"
        action={<AppButton onClick={() => openTradeForm()}>Cadastrar Primeira Compra</AppButton>}
      />
    )
  }

  return (
    <PortfolioOverviewScreen
      key={portfolio?.id}
      positions={positions}
      categories={portfolio?.custom_categories ?? EMPTY_LIST}
      patrimonyEvolution={patrimonyQuery.data ?? EMPTY_LIST}
      dividends={dividendsQuery.data ?? EMPTY_LIST}
      returnCurves={returnCurves}
      benchmarks={benchmarksQuery.data ?? EMPTY_MAP}
      cdiCagr={cdiCagrQuery.data?.cagr ?? null}
      pending={{
        benchmarks: benchmarksQuery.isPending,
        cdi: cdiCagrQuery.isPending,
        dividends: dividendsQuery.isPending,
        patrimony: patrimonyQuery.isPending,
      }}
      errors={{
        returns: returnCurves.isError || (benchmarksQuery.isError && !benchmarksQuery.data),
        dividends: dividendsQuery.isError && !dividendsQuery.data,
        patrimony: patrimonyQuery.isError && !patrimonyQuery.data,
      }}
      onPatrimonyRequest={() => setPatrimonyPortfolioId(portfolio?.id)}
      onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
    />
  )
}
