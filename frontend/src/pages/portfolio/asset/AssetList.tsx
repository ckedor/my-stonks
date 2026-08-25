import AssetCard from '@/components/portfolio-asset/AssetCard'
import {
  AppConfirmDialog,
  AppDateField,
  AppGrid,
  AppGroupHeader,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppSnackbar,
  AppStack,
  AppStackItem,
  AppText,
  AppToggleGroup,
  MiniDonut,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { CATEGORY_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Position {
  ticker: string
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

type GroupBy = 'category' | 'asset' | 'type' | 'class' | 'broker'

interface AssetListProps {
  positions: Position[]
  groupBy?: GroupBy
  onGroupByChange?: (groupBy: GroupBy) => void
}

type ViewMode = 'list' | 'card'

const VIEW_STORAGE_KEY = 'my-stonks:asset-list-view'

const GROUP_BY_OPTIONS = [
  { value: 'category', label: 'Categoria Usuário' },
  { value: 'asset', label: 'Ativo' },
  { value: 'type', label: 'Produto' },
  { value: 'class', label: 'Classe' },
  { value: 'broker', label: 'Corretora' },
]

const VIEW_OPTIONS = [
  { value: 'list' as const, label: 'Lista', icon: <ViewListIcon fontSize="small" /> },
  { value: 'card' as const, label: 'Cards', icon: <GridViewIcon fontSize="small" /> },
]

/** Percentual é percentual: passá-lo pelo formatador de moeda escrevia
 *  "R$ 41,98%" na coluna de CAGR e na de lucro. */
const formatPercent = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

/** A escolha entre lista e cards é uma preferência de leitura, não um estado da
 *  sessão: quem prefere cards os quer de novo na próxima visita. */
function readView(): ViewMode {
  if (typeof window === 'undefined') return 'list'
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'card' ? 'card' : 'list'
}

export default function AssetList({ positions, groupBy = 'category', onGroupByChange }: AssetListProps) {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const navigate = useNavigate()
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const [search, setSearch] = useState('')
  const [view, setViewState] = useState<ViewMode>(readView)
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)

  const setView = (next: ViewMode) => {
    setViewState(next)
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // Armazenamento cheio ou bloqueado não pode quebrar a listagem.
    }
  }
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    categoryId: number | null
    assetId: number | null
  }>({ open: false, categoryId: null, assetId: null })
  const [snackbarOpen, setSnackbarOpen] = useState(false)

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

  const filtered = positions.filter((pos) =>
    pos.ticker.toLowerCase().includes(search.toLowerCase())
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

  const handleCategoryChange = (assetId: number, categoryId: number) => {
    setConfirmDialog({ open: true, assetId, categoryId })
  }

  const confirmCategoryChange = async () => {
    if (!confirmDialog.assetId || !confirmDialog.categoryId) return
    try {
      await api.post(CATEGORY_ROUTES.assignment, {
        asset_id: confirmDialog.assetId,
        category_id: confirmDialog.categoryId,
        portfolio_id: selectedPortfolio?.id,
      })
      setConfirmDialog({ open: false, assetId: null, categoryId: null })
    } catch (error) {
      console.error('Erro ao atualizar categoria', error)
      setSnackbarOpen(true)
    }
  }

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
      render: (pos) => (
        <AppStack>
          <AppText variant="bodySmall" weight="strong" noWrap>
            {pos.name || pos.ticker}
          </AppText>
          <AppText variant="caption" tone="secondary" noWrap>
            {pos.ticker} · {pos.type}
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
        <AppSelect
          size="full"
          options={userCategories.map((cat) => ({ value: String(cat.id), label: cat.name }))}
          value={String(userCategories.find((c) => c.name === pos.category)?.id ?? '')}
          onChange={(value) => handleCategoryChange(pos.asset_id, Number(value))}
        />
      ),
    },
  ]

  return (
    <AppStack gap="md">
      {/* Barra de filtros */}
      <AppStack direction="row" gap="md" align="center" collapseBelow="sm">
        <AppSearchField label="Buscar Ativo" value={search} onChange={setSearch} />
        <AppSelect
          label="Agrupar"
          options={GROUP_BY_OPTIONS}
          value={groupBy}
          onChange={(value) => onGroupByChange?.(value as GroupBy)}
          density="comfortable"
        />
        <AppStackItem>
          <AppStack direction="row" gap="md" align="center" justify="end">
            <AppDateField label="Data" value={selectedDate} onChange={setSelectedDate} />
            <AppToggleGroup
              label="Modo de exibição"
              options={VIEW_OPTIONS}
              value={view}
              onChange={setView}
            />
          </AppStack>
        </AppStackItem>
      </AppStack>

      {/* Grupos */}
      <AppStack gap="lg">
        {sortedGrouped.map(([category, items]) => {
          const groupTotal = items.reduce((a, c) => a + c.value, 0)
          const catColor = categoryColorMap[category] ?? theme.palette.primary.main

          return (
            <AppStack key={category} gap="sm">
              <AppGroupHeader
                title={category}
                color={catColor}
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
      </AppStack>

      <AppConfirmDialog
        open={confirmDialog.open}
        title="Confirmar Alteração"
        tone="primary"
        onConfirm={confirmCategoryChange}
        onCancel={() => setConfirmDialog({ open: false, assetId: null, categoryId: null })}
      >
        Deseja realmente alterar a categoria deste ativo?
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbarOpen}
        message="Erro ao atualizar categoria."
        severity="error"
        onClose={() => setSnackbarOpen(false)}
      />
    </AppStack>
  )
}
