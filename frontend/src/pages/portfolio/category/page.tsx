import { EMPTY_LIST } from '@/queries/empty'
import { useQuery } from '@tanstack/react-query'
import { useDividends, usePatrimony, usePositions, useReturnCurves, useSelectedPortfolio, useTrades } from '@/queries/portfolio'
import { fetchCategoryAnalysis } from '@/api/portfolio'
import PortfolioSliceScreen from '@/components/portfolio-slice/PortfolioSliceScreen'
import PortfolioSliceScreenSkeleton from '@/components/portfolio-slice/PortfolioSliceScreenSkeleton'
import { CONCENTRATION_DIMENSIONS } from '@/components/portfolio-slice/concentration'
import type { SliceTabId } from '@/components/portfolio-slice/tabs'
import { AppSelect, AppText } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { AssetAnalysis } from '@/types'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

/** Benchmark padrão quando a categoria não escolheu um. */
const DEFAULT_BENCHMARK = 'CDI'

/** Por onde a concentração de uma categoria é lida. Ela não tem subtipo
 *  próprio — quem a define é o usuário —, então sobram o ativo, o tipo e a
 *  classe do que está dentro dela. */
const DIMENSIONS = [
  CONCENTRATION_DIMENSIONS.asset,
  CONCENTRATION_DIMENSIONS.assetType,
  CONCENTRATION_DIMENSIONS.assetClass,
]

/** A carteira inteira, vista por uma categoria só.
 *
 *  É a mesma tela de um segmento: o que muda é só como o recorte é escolhido —
 *  ali um tipo de ativo, aqui um agrupamento do usuário. A categoria continua
 *  na URL, para o link continuar valendo.
 *
 *  Os dados são os mesmos que as telas da carteira já carregam — posições,
 *  rentabilidade por categoria, patrimônio, proventos e trades estão nos
 *  stores —, e a única busca própria desta tela é a análise de risco da
 *  categoria. */
export default function PortfolioCategoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const categoryId = Number(id)

  const selectedPortfolio = useSelectedPortfolio()
  const portfolioId = selectedPortfolio?.id
  const categories = useMemo(
    () => selectedPortfolio?.custom_categories ?? [],
    [selectedPortfolio],
  )
  const category = categories.find((item) => item.id === categoryId)

  const { currency } = useCurrency()

  const positions = usePositions().data ?? EMPTY_LIST
  const positionsLoading = usePositions().isPending
  const categoryReturns = useReturnCurves().series
  const categoryCagr = useReturnCurves().cagr
  const patrimony = usePatrimony().data ?? EMPTY_LIST
  const dividends = useDividends().data ?? EMPTY_LIST
  const trades = useTrades().data ?? EMPTY_LIST

  const [tab, setTab] = useState<SliceTabId>('rentabilidade')

  const name = category?.name ?? ''
  const returns = useMemo(() => categoryReturns[name] ?? [], [categoryReturns, name])
  const ownPositions = useMemo(
    () =>
      positions
        .filter((position) => position.category === name)
        .sort((a, b) => b.value - a.value),
    [positions, name],
  )

  const { data: analysis, isPending: analysisLoading } = useQuery<AssetAnalysis>({
    queryKey: [portfolioId && category ? `category-analysis:${portfolioId}:${category.id}:${currency}` : null],
    queryFn: useCallback(
      () => fetchCategoryAnalysis(portfolioId!, categoryId, currency),
      [portfolioId, categoryId, currency],
    ),
    enabled: (portfolioId && category ? `category-analysis:${portfolioId}:${category.id}:${currency}` : null) != null && !!portfolioId && !!category && tab === 'risco',
  })

  if (positionsLoading) return <PortfolioSliceScreenSkeleton titleWidth={200} actions={1} />

  /* Sem categoria na URL — a entrada do menu — abre a primeira, que é o que a
     tela tem a mostrar; a URL passa a nomear o que está na tela. */
  if (!id && categories.length > 0) {
    return <Navigate to={`/portfolio/category/${categories[0].id}`} replace />
  }

  if (!portfolioId || !category) {
    return <AppText tone="secondary">Categoria não encontrada nesta carteira.</AppText>
  }

  const portfolioValue = positions.reduce((sum, position) => sum + position.value, 0)

  return (
    <PortfolioSliceScreen
      portfolioId={portfolioId}
      title={category.name}
      breadcrumbs={[
        { label: 'Carteira', href: '/portfolio/overview' },
        { label: 'Categorias' },
      ]}
      actions={
        <AppSelect
          label="Categoria"
          options={categories.map((item) => ({
            value: String(item.id),
            label: item.name,
          }))}
          value={String(category.id)}
          onChange={(value) => navigate(`/portfolio/category/${value}`)}
        />
      }
      accentColor={category.color}
      persistKey={`category:${name}`}
      positions={ownPositions}
      portfolioValue={portfolioValue}
      dimensions={DIMENSIONS}
      emptyMessage="Nenhum ativo nesta categoria."
      returns={returns}
      benchmarks={[category.benchmark?.short_name ?? DEFAULT_BENCHMARK]}
      categoryName={name}
      cagr={categoryCagr[name] ?? null}
      analysis={analysis ?? null}
      analysisLoading={analysisLoading}
      patrimony={patrimony}
      patrimonySeriesKey={name}
      allDividends={dividends}
      dividendsChartSelection={name}
      allTrades={trades}
      tab={tab}
      onTabChange={setTab}
    />
  )
}
