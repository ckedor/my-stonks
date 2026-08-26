import { fetchCategoryAnalysis } from '@/api/portfolio'
import {
  AppBreadcrumbs,
  AppCard,
  AppColorSwatch,
  AppDivider,
  AppMetric,
  AppSelect,
  AppStack,
  AppTabs,
  AppText,
  LoadingSpinner,
  PageTitle,
} from '@/components/ui'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import type { AssetAnalysis } from '@/types'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import CategoryAssets from './CategoryAssets'
import CategoryDividendsTab from './CategoryDividendsTab'
import CategoryReturnsTab from './CategoryReturnsTab'
import CategoryRiskTab from './CategoryRiskTab'
import CategoryWealthTab from './CategoryWealthTab'
import { categoryPositions, summarizeCategory } from './summary'

type TabId = 'rentabilidade' | 'risco' | 'patrimonio' | 'proventos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'rentabilidade', label: 'Rentabilidade' },
  { id: 'risco', label: 'Risco' },
  { id: 'patrimonio', label: 'Patrimônio' },
  { id: 'proventos', label: 'Proventos' },
]

/** Benchmark padrão quando a categoria não escolheu um. */
const DEFAULT_BENCHMARK = 'CDI'

/** A carteira inteira, vista por uma categoria só.
 *
 *  Todas as categorias mostram a mesma tela, então é uma tela só: a categoria
 *  é escolhida num select e continua na URL, para o link continuar valendo.
 *
 *  Os dados são os mesmos que as telas da carteira já carregam — posições,
 *  rentabilidade por categoria, patrimônio e proventos estão nos stores —, e a
 *  única busca própria desta tela é a análise de risco da categoria, que o
 *  backend calcula por `/portfolio/position/{id}/category/{id}/analysis`. */
export default function PortfolioCategoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const categoryId = Number(id)

  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const portfolioId = selectedPortfolio?.id
  const categories = useMemo(
    () => selectedPortfolio?.custom_categories ?? [],
    [selectedPortfolio],
  )
  const category = categories.find((item) => item.id === categoryId)

  const { currency, format: formatCurrency } = useCurrency()

  const positions = usePositionsStore((s) => s.positions)
  const positionsLoading = usePositionsStore((s) => s.loading) && positions.length === 0
  const categoryReturns = useReturnsStore((s) => s.categoryReturns)
  const categoryCagr = useReturnsStore((s) => s.categoryCagr)
  const patrimony = usePatrimonyStore((s) => s.patrimony)
  const dividends = useDividendsStore((s) => s.dividends)

  const [tab, setTab] = useState<TabId>('rentabilidade')

  const name = category?.name ?? ''
  const returns = useMemo(() => categoryReturns[name] ?? [], [categoryReturns, name])

  const summary = useMemo(
    () => summarizeCategory(positions, returns, name),
    [positions, returns, name],
  )
  const ownPositions = useMemo(() => categoryPositions(positions, name), [positions, name])

  const { data: analysis, loading: analysisLoading } = useCachedData<AssetAnalysis>(
    portfolioId && category ? `category-analysis:${portfolioId}:${category.id}:${currency}` : null,
    useCallback(
      () => fetchCategoryAnalysis(portfolioId!, categoryId, currency),
      [portfolioId, categoryId, currency],
    ),
    { enabled: !!portfolioId && !!category && tab === 'risco' },
  )

  if (positionsLoading) return <LoadingSpinner />

  /* Sem categoria na URL — a entrada do menu — abre a primeira, que é o que a
     tela tem a mostrar; a URL passa a nomear o que está na tela. */
  if (!id && categories.length > 0) {
    return <Navigate to={`/portfolio/category/${categories[0].id}`} replace />
  }

  if (!portfolioId || !category) {
    return <AppText tone="secondary">Categoria não encontrada nesta carteira.</AppText>
  }

  const cagr = categoryCagr[name] ?? null
  const percent = (value: number) =>
    `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

  return (
    <AppStack gap="lg">
      <AppStack gap="xs">
        <AppBreadcrumbs
          items={[
            { label: 'Carteira', href: '/portfolio/overview' },
            { label: 'Categorias' },
          ]}
        />
        <AppStack direction="row" align="center" gap="md" wrap>
          <AppStack direction="row" align="center" gap="sm">
            <AppColorSwatch color={category.color} />
            <PageTitle>{category.name}</PageTitle>
          </AppStack>
          <AppSelect
            label="Categoria"
            options={categories.map((item) => ({
              value: String(item.id),
              label: item.name,
            }))}
            value={String(category.id)}
            onChange={(value) => navigate(`/portfolio/category/${value}`)}
          />
        </AppStack>
      </AppStack>

      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric label="Patrimônio" value={formatCurrency(summary.value)} size="lg" />
          <AppMetric
            label="Rentabilidade acumulada"
            value={summary.accReturn == null ? '—' : percent(summary.accReturn * 100)}
            tone={summary.accReturn != null && summary.accReturn < 0 ? 'danger' : 'success'}
          />
          <AppMetric
            label="CAGR"
            value={cagr == null ? '—' : `${percent(cagr * 100)} a.a.`}
            tone={cagr != null && cagr < 0 ? 'danger' : 'success'}
          />
          <AppMetric
            label="Peso na carteira"
            value={summary.weight == null ? '—' : `${summary.weight.toFixed(1).replace('.', ',')}%`}
          />
          <AppMetric label="Ativos" value={String(summary.assetCount)} />
        </AppStack>
      </AppCard>

      <CategoryAssets
        positions={ownPositions}
        portfolioId={portfolioId}
        color={category.color}
      />

      <AppDivider />

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Visões da categoria" />

      {tab === 'rentabilidade' && (
        <CategoryReturnsTab
          category={name}
          benchmark={category.benchmark?.short_name ?? DEFAULT_BENCHMARK}
          returns={returns}
        />
      )}
      {tab === 'risco' && <CategoryRiskTab analysis={analysis} loading={analysisLoading} />}
      {tab === 'patrimonio' && (
        <CategoryWealthTab category={name} patrimonyEvolution={patrimony} cagr={cagr} />
      )}
      {tab === 'proventos' && <CategoryDividendsTab category={name} dividends={dividends} />}
    </AppStack>
  )
}
