import { useSelectedPortfolio } from '@/queries/portfolio'
import AssetCard from '@/components/portfolio-asset/AssetCard'
import {
  AppGrid,
  AppGroupHeader,
  AppSimpleTable,
  AppStack,
  AppText,
  MiniDonut,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { AssetGroupBy, AssetListView } from './view-state'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryAssignmentPrompt, CategoryCell } from './CategoryAssignment'
import { useCategoryAssignment } from './category-assignment'

interface Position {
  ticker: string | null
  name?: string
  quantity: number
  price: number
  value: number
  category: string
  class: string
  type: string
  asset_id: number
  twelve_months_return: number
  acc_return: number
  cagr?: number | null
  total_invested?: number
  broker_name?: string
  broker_id?: number
}

interface AssetListProps {
  positions: Position[]
  /** Os filtros são do cabeçalho da página, que é quem os guarda. */
  groupBy: AssetGroupBy
  search: string
  view: AssetListView
}

/** Percentual é percentual: passá-lo pelo formatador de moeda escrevia
 *  "R$ 41,98%" na coluna de CAGR e na de lucro. */
const formatPercent = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

export default function AssetList({ positions, groupBy, search, view }: AssetListProps) {
  const selectedPortfolio = useSelectedPortfolio()
  const navigate = useNavigate()
  const assignment = useCategoryAssignment()
  const userCategories = assignment.categories

  const theme = useAppTheme()

  /* Cor e id por nome de categoria. O id existe porque o cabeçalho do grupo
     leva para a página da categoria — é onde a pessoa já está olhando para o
     nome dela. Só agrupando por categoria: nos outros agrupamentos o título é
     um tipo ou uma corretora, que não têm página. */
  const { categoryColorMap, categoryIdMap } = useMemo(() => {
    const colors: Record<string, string> = {}
    const ids: Record<string, number> = {}
    for (const cat of userCategories) {
      colors[cat.name] = cat.color
      ids[cat.name] = cat.id
    }
    return { categoryColorMap: colors, categoryIdMap: ids }
  }, [userCategories])

  const totalPortfolioValue = useMemo(
    () => positions.reduce((s, p) => s + p.value, 0),
    [positions],
  )

  const term = search.toLowerCase()
  const filtered = positions.filter((pos) =>
    term === '' ||
    (pos.ticker?.toLowerCase().includes(term) ?? false) ||
    (pos.name?.toLowerCase().includes(term) ?? false)
  )

  const grouped = filtered.reduce<Record<string, Position[]>>((acc, pos) => {
    const key =
      groupBy === 'category'
        ? pos.category || '(Sem categoria)'
        : groupBy === 'type'
          ? pos.type
          : groupBy === 'class'
            ? pos.class
            : groupBy === 'broker'
              ? pos.broker_name || '(Sem corretora)'
              : 'Ativos'
    if (!acc[key]) acc[key] = []
    acc[key].push(pos)
    return acc
  }, {})

  Object.values(grouped).forEach((group) => {
    group.sort((a, b) => b.value - a.value)
  })

  const sortedGrouped = Object.entries(grouped).sort(([, a], [, b]) => {
    const totalA = a.reduce((acc, item) => acc + item.value, 0)
    const totalB = b.reduce((acc, item) => acc + item.value, 0)
    return totalB - totalA
  })

  const { format: formatCurrency } = useCurrency()

  /** Três degraus pelo sinal: o número que subiu, o que caiu e o que não diz
   *  nada. É a mesma leitura que a tela inteira faz de um retorno. */
  const signTone = (value: number | null | undefined) =>
    value == null || value === 0 ? 'default' : value > 0 ? 'success' : 'danger'

  const columns = (catColor: string): AppSimpleTableColumn<Position>[] => [
    {
      label: '',
      render: (pos) => (
        <MiniDonut
          value={totalPortfolioValue > 0 ? (pos.value / totalPortfolioValue) * 100 : 0}
          color={catColor}
        />
      ),
    },
    {
      label: 'Ativo',
      width: 'clamped',
      render: (pos) => (
        <AppStack>
          <AppText variant="bodySmall" weight="strong" noWrap>
            {pos.name || pos.ticker}
          </AppText>
          <AppText variant="caption" tone="secondary" noWrap>
            {[pos.ticker, pos.type].filter(Boolean).join(' · ')}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Quantidade',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall">
          {pos.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
        </AppText>
      ),
    },
    {
      label: 'Preço Unit.',
      align: 'right',
      render: (pos) => <AppText variant="bodySmall">{formatCurrency(pos.price)}</AppText>,
    },
    {
      label: 'Valor Total',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall" weight="strong">
          {formatCurrency(pos.value)}
        </AppText>
      ),
    },
    {
      label: 'Investido',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall" tone="secondary">
          {(pos.total_invested ?? 0) > 0 ? formatCurrency(pos.total_invested ?? 0) : '—'}
        </AppText>
      ),
    },
    {
      label: 'CAGR',
      align: 'right',
      render: (pos) => (
        <AppText variant="bodySmall" weight="strong" tone={signTone(pos.cagr)}>
          {pos.cagr != null ? formatPercent(pos.cagr * 100) : '—'}
        </AppText>
      ),
    },
    {
      label: 'Lucro',
      align: 'right',
      render: (pos) => {
        const invested = pos.total_invested ?? 0
        const profit = pos.value - invested
        const profitPct = invested > 0 ? (profit / invested) * 100 : null
        return (
          <AppStack align="end">
            <AppText variant="bodySmall" weight="strong" tone={signTone(profit)}>
              {invested > 0 ? formatCurrency(profit) : '—'}
            </AppText>
            {profitPct != null && (
              <AppText variant="caption" tone={signTone(profitPct)}>
                {profitPct > 0 ? '+' : ''}
                {formatPercent(profitPct)}
              </AppText>
            )}
          </AppStack>
        )
      },
    },
    {
      label: 'Categoria',
      render: (pos) => (
        <CategoryCell assignment={assignment} assetId={pos.asset_id} categoryName={pos.category} />
      ),
    },
  ]

  return (
    <AppStack gap="lg">
      {sortedGrouped.map(([category, items]) => {
          const groupTotal = items.reduce((a, c) => a + c.value, 0)
          const catColor = categoryColorMap[category] ?? theme.palette.primary.main

          return (
            <AppStack key={category} gap="sm">
              <AppGroupHeader
                title={category}
                onTitleClick={
                  groupBy === 'category' && categoryIdMap[category] != null
                    ? () => navigate(`/portfolio/category/${categoryIdMap[category]}`)
                    : undefined
                }
                trailing={
                  <AppText variant="bodySmall" weight="strong">
                    {formatCurrency(groupTotal)}
                  </AppText>
                }
              />

              {view === 'card' ? (
                <AppGrid cols={{ xs: 1, sm: 2, md: 3 }} gap="md">
                  {items.map((pos) => (
                    <AssetCard
                      key={pos.asset_id}
                      position={pos}
                      portfolioId={selectedPortfolio!.id}
                      weight={totalPortfolioValue > 0 ? (pos.value / totalPortfolioValue) * 100 : 0}
                      accentColor={catColor}
                    />
                  ))}
                </AppGrid>
              ) : (
                <AppSimpleTable
                  rows={items}
                  columns={columns(catColor)}
                  getRowKey={(pos) => pos.asset_id}
                  onRowClick={(pos) => navigate(`/portfolio/asset/${pos.asset_id}`)}
                />
              )}
        </AppStack>
        )
      })}

      <CategoryAssignmentPrompt assignment={assignment} />
    </AppStack>
  )
}
