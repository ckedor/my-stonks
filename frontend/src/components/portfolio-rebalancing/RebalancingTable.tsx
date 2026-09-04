import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'

import {
  AppCard,
  AppIconButton,
  AppNumberField,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type {
  AssetRebalancingEntry,
  CategoryRebalancingEntry,
  RebalancingResponse,
} from '@/types'

/* Categoria, ativo e total moram na mesma tabela porque são a mesma leitura em
 * três níveis: quanto há, quanto se quer, quanto falta. A categoria abre e
 * fecha; o ativo só aparece com a categoria aberta; o total fecha a conta. */
type Row =
  | { kind: 'category'; key: string; category: CategoryRebalancingEntry; buy: number }
  | {
      kind: 'asset'
      key: string
      categoryId: number
      asset: AssetRebalancingEntry
      targetSet: boolean
      buy: number
    }
  | { kind: 'total'; key: string }

const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—')

/** O sinal de uma diferença, lido como o resto do app lê retorno. */
const diffTone = (v: number | null): 'success' | 'danger' | 'default' =>
  v == null || v === 0 ? 'default' : v > 0 ? 'success' : 'danger'

export interface RebalancingTableProps {
  view: RebalancingResponse
  buyPlan: { byCategory: Map<number, number>; byAsset: Map<number, number> }
  openCategories: number[]
  onToggleCategory: (categoryId: number) => void
  onCategoryTargetChange: (categoryId: number, value: number | null) => void
  onAssetTargetChange: (categoryId: number, assetId: number, value: number | null) => void
  simulating: boolean
  contribution: number | null
  categoryTargetSum: number
}

export default function RebalancingTable({
  view,
  buyPlan,
  openCategories,
  onToggleCategory,
  onCategoryTargetChange,
  onAssetTargetChange,
  simulating,
  contribution,
  categoryTargetSum,
}: RebalancingTableProps) {
  const { format: fmt } = useCurrency()

  const currentPctSum = view.categories.reduce((sum, cat) => sum + cat.current_pct, 0)

  const rows: Row[] = [
    ...view.categories.flatMap<Row>((category) => {
      const open = openCategories.includes(category.category_id)
      const categoryRow: Row = {
        kind: 'category',
        key: `cat-${category.category_id}`,
        category,
        buy: buyPlan.byCategory.get(category.category_id) ?? 0,
      }
      if (!open) return [categoryRow]
      return [
        categoryRow,
        ...category.assets.map<Row>((asset) => ({
          kind: 'asset',
          key: `asset-${category.category_id}-${asset.asset_id}`,
          categoryId: category.category_id,
          asset,
          targetSet: category.target_pct != null,
          buy: buyPlan.byAsset.get(asset.asset_id) ?? 0,
        })),
      ]
    }),
    { kind: 'total', key: 'total' },
  ]

  const columns: AppSimpleTableColumn<Row>[] = [
    {
      label: 'Categoria / Ativo',
      render: (row) => {
        if (row.kind === 'total') return <AppText weight="strong">Total</AppText>
        if (row.kind === 'category') {
          const open = openCategories.includes(row.category.category_id)
          return (
            <AppStack direction="row" gap="xs" align="center">
              <AppIconButton
                size="sm"
                label={open ? 'Recolher categoria' : 'Expandir categoria'}
                onClick={() => onToggleCategory(row.category.category_id)}
              >
                {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              </AppIconButton>
              {/* Sem o ponto na cor da categoria: verde e vermelho já
                  significam sinal nas colunas à direita, e um "Bolsa BR"
                  verde ao lado de um número vermelho fazia a linha inteira
                  se contradizer. A cor da categoria está nas pizzas acima,
                  onde ela identifica uma fatia. */}
              <AppText weight="strong">{row.category.category_name}</AppText>
            </AppStack>
          )
        }
        return (
          <AppStack direction="row" gap="xs" align="baseline" indent="lg">
            <AppText variant="bodySmall" weight="strong">
              {row.asset.ticker}
            </AppText>
            {row.asset.name && (
              <AppText variant="caption" tone="secondary" noWrap>
                {row.asset.name}
              </AppText>
            )}
          </AppStack>
        )
      },
    },
    {
      label: 'Valor Atual',
      align: 'right',
      render: (row) =>
        row.kind === 'total'
          ? fmt(view.total_value)
          : row.kind === 'category'
            ? fmt(row.category.current_value)
            : fmt(row.asset.current_value),
    },
    {
      label: '% Atual',
      align: 'right',
      /* No total, a soma do que está na tela — e não um "100,00%" escrito à
         mão. Na carteira inteira dá 100 de qualquer jeito; num recorte, dá
         quanto ele pesa, que é a resposta certa. */
      render: (row) =>
        row.kind === 'total'
          ? fmtPct(currentPctSum)
          : row.kind === 'category'
            ? fmtPct(row.category.current_pct)
            : fmtPct(row.asset.current_pct_in_category),
    },
    {
      label: '% Alvo',
      align: 'right',
      render: (row) => {
        if (row.kind === 'total') {
          return categoryTargetSum > 0
            ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%`
            : '—'
        }
        const isCategory = row.kind === 'category'
        return (
          <AppNumberField
            label={isCategory ? 'Alvo da categoria' : 'Alvo do ativo'}
            hideLabel
            align="right"
            size="xs"
            allowEmpty
            step={0.01}
            value={isCategory ? row.category.target_pct : row.asset.target_pct_in_category}
            onChange={(value) =>
              isCategory
                ? onCategoryTargetChange(row.category.category_id, value)
                : onAssetTargetChange(row.categoryId, row.asset.asset_id, value)
            }
          />
        )
      },
    },
    {
      label: 'Dif. %',
      align: 'right',
      render: (row) => {
        if (row.kind === 'total') return '—'
        const value = row.kind === 'category' ? row.category.diff_pct : row.asset.diff_pct
        const show = row.kind === 'category' || row.targetSet
        return (
          <AppText variant="bodySmall" tone={diffTone(value)}>
            {show ? fmtPct(value) : '—'}
          </AppText>
        )
      },
    },
    /* A última coluna troca de pergunta com o interruptor.
     *
     * Desligado ela é diagnóstico: quanto falta para o alvo, negativo
     * inclusive — quem está acima aparece como excesso. Ligado ela é a
     * resposta ao aporte, e aporte é compra: nunca sai negativa, porque
     * ninguém aporta pensando em vender. */
    simulating
      ? {
          label: 'Comprar',
          align: 'right' as const,
          render: (row: Row) => {
            if (row.kind === 'total') {
              return <AppText weight="strong">{fmt(contribution ?? 0)}</AppText>
            }
            if (row.buy <= 0) {
              return (
                <AppText variant="bodySmall" tone="secondary">
                  —
                </AppText>
              )
            }
            return (
              <AppText variant="bodySmall" tone="success">
                {fmt(row.buy)}
              </AppText>
            )
          },
        }
      : {
          label: 'Aporte',
          align: 'right' as const,
          render: (row: Row) => {
            if (row.kind === 'total') return '—'
            const value = row.kind === 'category' ? row.category.diff_value : row.asset.diff_value
            const show = (row.kind === 'category' || row.targetSet) && value != null
            return (
              <AppText variant="bodySmall" tone={diffTone(value)}>
                {show ? fmt(value as number) : '—'}
              </AppText>
            )
          },
        },
  ]

  return (
    <AppCard padding="none">
      <AppSimpleTable
        rows={rows}
        columns={columns}
        getRowKey={(row) => row.key}
        /* A categoria fica no papel do card e o ativo aberto é que afunda.
           Estava invertido: `sunken` é a cor da página, então a linha de
           categoria — a que se lê primeiro — sumia contra o fundo. */
        getRowSurface={(row) => (row.kind === 'category' ? 'paper' : 'sunken')}
      />
    </AppCard>
  )
}
