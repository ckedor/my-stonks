import PortfolioOverviewScreen from '@/components/portfolio-overview/PortfolioOverviewScreen'
import { AppButton, AppEmptyState } from '@/components/ui'
import { EMPTY_LIST, EMPTY_MAP } from '@/queries/empty'
import {
  useAnalysis,
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
  const patrimonyQuery = usePatrimony()
  const dividendsQuery = useDividends()
  const benchmarksQuery = useBenchmarks()
  const analysisQuery = useAnalysis()
  const returnCurves = useReturnCurves()

  const positions = positionsQuery.data ?? EMPTY_LIST

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
    benchmarksQuery.isPending ||
    analysisQuery.isPending ||
    returnCurves.isPending

  if (loading) {
    return <OverviewSkeleton />
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
      positions={positions}
      categories={portfolio?.custom_categories ?? EMPTY_LIST}
      patrimonyEvolution={patrimonyQuery.data ?? EMPTY_LIST}
      dividends={dividendsQuery.data ?? EMPTY_LIST}
      returnCurves={returnCurves}
      benchmarks={benchmarksQuery.data ?? EMPTY_MAP}
      cdiCagr={analysisQuery.data?.performance_metrics?.benchmarks_metrics?.['CDI']?.cagr ?? null}
      onAssetSelect={(assetId) => navigate(`/portfolio/asset/${assetId}`)}
    />
  )
}
