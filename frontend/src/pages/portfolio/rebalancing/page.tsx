import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  AppAlert,
  AppButton,
  AppCard,
  AppGrid,
  AppGridItem,
  AppIconButton,
  AppMetric,
  AppNumberField,
  AppPageHeader,
  AppSimpleTable,
  AppSnackbar,
  AppStack,
  AppSwitch,
  AppText,
  LoadingSpinner,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { REBALANCING_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import type {
  AssetRebalancingEntry,
  CategoryRebalancingEntry,
  RebalancingResponse,
} from '@/types'
import AllocationPie from './AllocationPie'
import { planContribution } from './contribution'

const fmtPct = (v: number | null) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—'

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

/** O sinal de uma diferença, lido como o resto do app lê retorno. */
const diffTone = (v: number | null): 'success' | 'danger' | 'default' =>
  v == null || v === 0 ? 'default' : v > 0 ? 'success' : 'danger'

const round2 = (v: number) => Math.round(v * 100) / 100

/* Refaz a conta do backend sobre os alvos editados na tela.
 *
 * Só existe porque os alvos são editáveis: mudar um `% Alvo` tem de mover a
 * diferença na mesma hora, antes de salvar. A base é sempre o patrimônio de
 * hoje — o aporte simulado não entra aqui, e é justamente por ele entrar que
 * a tela confundia antes: digitar um valor reescrevia o diagnóstico inteiro
 * contra uma carteira que ainda não existe. */
function withDiffs(data: RebalancingResponse): RebalancingResponse {
  const total = data.total_value

  return {
    ...data,
    categories: data.categories.map((cat) => {
      const targetValue = cat.target_pct != null ? (total * cat.target_pct) / 100 : null

      return {
        ...cat,
        target_value: targetValue != null ? round2(targetValue) : null,
        diff_pct: cat.target_pct != null ? round2(cat.target_pct - cat.current_pct) : null,
        diff_value: targetValue != null ? round2(targetValue - cat.current_value) : null,
        assets: cat.assets.map((asset) => {
          if (asset.target_pct_in_category == null || targetValue == null) {
            return { ...asset, target_value: null, diff_value: null, diff_pct: null }
          }
          const assetTarget = (targetValue * asset.target_pct_in_category) / 100
          return {
            ...asset,
            target_value: round2(assetTarget),
            diff_value: round2(assetTarget - asset.current_value),
            diff_pct: round2(asset.target_pct_in_category - asset.current_pct_in_category),
          }
        }),
      }
    }),
  }
}

export default function RebalancingPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const { format: fmt, symbol: currencySymbol } = useCurrency()

  const portfolioId = selectedPortfolio?.id

  const { data: fetchedData } = useCachedData<RebalancingResponse>(
    portfolioId ? `rebalancing:${portfolioId}` : null,
    useCallback(() => api.get<RebalancingResponse>(REBALANCING_ROUTES.byPortfolio(portfolioId!)).then(r => r.data), [portfolioId]),
    { enabled: !!portfolioId },
  )

  /* `data` guarda só os alvos: é o rascunho que o botão de salvar envia. Tudo
     que é derivado — diferença, valor alvo, plano de compra — se recalcula a
     partir dele, em vez de ser escrito de volta nele. */
  const [data, setData] = useState<RebalancingResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [simulating, setSimulating] = useState(false)
  const [contribution, setContribution] = useState<number | null>(null)
  const [openCategories, setOpenCategories] = useState<number[]>([])

  useEffect(() => {
    if (fetchedData) setData(fetchedData)
  }, [fetchedData])

  const loading = !fetchedData && !!portfolioId

  const view = useMemo(() => (data ? withDiffs(data) : null), [data])

  /* Quanto comprar de cada categoria, e de cada ativo dentro dela. Fora da
     simulação é tudo zero: sem aporte não há compra a sugerir. */
  const buyPlan = useMemo(() => {
    const empty = { byCategory: new Map<number, number>(), byAsset: new Map<number, number>() }
    if (!view || !simulating || !contribution) return empty

    const categoryPlan = planContribution(
      view.categories.map((cat) => ({ value: cat.current_value, targetPct: cat.target_pct })),
      contribution,
    )

    view.categories.forEach((cat, index) => {
      const amount = categoryPlan[index]
      empty.byCategory.set(cat.category_id, amount)

      /* Dentro da categoria vale a mesma regra: o que ela recebeu é o aporte,
         e os pesos são os alvos dos ativos dela. */
      const assetPlan = planContribution(
        cat.assets.map((asset) => ({
          value: asset.current_value,
          targetPct: asset.target_pct_in_category,
        })),
        amount,
      )
      cat.assets.forEach((asset, assetIndex) => {
        empty.byAsset.set(asset.asset_id, assetPlan[assetIndex])
      })
    })

    return empty
  }, [view, simulating, contribution])

  const effectiveTotal = (view?.total_value ?? 0) + (simulating ? (contribution ?? 0) : 0)

  /* As duas pizzas: como a carteira está, e como ela fica. Fora da simulação
     a segunda é a alocação alvo; dentro dela, a carteira depois do aporte —
     que é o que torna visível o efeito de ligar o interruptor. */
  const pies = useMemo(() => {
    if (!view) return { current: [], suggested: [] }

    const current = view.categories.map((cat) => ({
      label: cat.category_name,
      value: cat.current_value,
      color: cat.color,
    }))

    const suggested = view.categories.map((cat) => ({
      label: cat.category_name,
      color: cat.color,
      value: simulating
        ? cat.current_value + (buyPlan.byCategory.get(cat.category_id) ?? 0)
        : cat.target_pct != null
          ? (view.total_value * cat.target_pct) / 100
          : cat.current_value,
    }))

    return { current, suggested }
  }, [view, simulating, buyPlan])

  // ── Local edits ────────────────────────────────────────────────────
  const handleCategoryTargetChange = (categoryId: number, value: number | null) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((cat) =>
              cat.category_id === categoryId ? { ...cat, target_pct: value } : cat,
            ),
          }
        : prev,
    )
  }

  const handleAssetTargetChange = (
    categoryId: number,
    assetId: number,
    value: number | null
  ) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            categories: prev.categories.map((cat) =>
              cat.category_id !== categoryId
                ? cat
                : {
                    ...cat,
                    assets: cat.assets.map((asset) =>
                      asset.asset_id === assetId
                        ? { ...asset, target_pct_in_category: value }
                        : asset,
                    ),
                  },
            ),
          }
        : prev,
    )
  }

  // ── Save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!data || !selectedPortfolio) return
    setSaving(true)
    try {
      const payload = {
        portfolio_id: selectedPortfolio.id,
        categories: data.categories
          .filter((c) => c.category_id !== 0)
          .map((c) => ({
            category_id: c.category_id,
            target_percentage: c.target_pct ?? 0,
            assets: c.assets.map((a) => ({
              asset_id: a.asset_id,
              target_percentage: a.target_pct_in_category ?? 0,
            })),
          })),
      }
      await api.put(REBALANCING_ROUTES.byPortfolio(selectedPortfolio.id), payload)
      setSnackbar({
        open: true,
        message: 'Targets salvos com sucesso!',
        severity: 'success',
      })
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Erro ao salvar targets.'
      setSnackbar({ open: true, message: detail, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Computed sums ──────────────────────────────────────────────────
  const categoryTargetSum = view
    ? view.categories.reduce((s, c) => s + (c.target_pct ?? 0), 0)
    : 0

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingSpinner />
  }

  if (!view || view.categories.length === 0) {
    return <AppAlert severity="info">Nenhuma posição encontrada para rebalanceamento.</AppAlert>
  }

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

  const toggleCategory = (categoryId: number) =>
    setOpenCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    )

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
                onClick={() => toggleCategory(row.category.category_id)}
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
      render: (row) =>
        row.kind === 'total'
          ? '100,00%'
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
                ? handleCategoryTargetChange(row.category.category_id, value)
                : handleAssetTargetChange(row.categoryId, row.asset.asset_id, value)
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
    <AppStack gap="lg">
      <AppPageHeader
        title="Rebalanceamento"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Rebalanceamento' },
        ]}
        actions={
          <>
            <AppSwitch
              label="Simular aporte"
              hint="Distribui o dinheiro novo comprando o que está mais atrasado, sem sugerir venda."
              checked={simulating}
              onChange={setSimulating}
            />
            {simulating && (
              <AppNumberField
                label="Aporte"
                size="md"
                allowEmpty
                step={0.01}
                prefix={currencySymbol}
                value={contribution}
                onChange={setContribution}
              />
            )}
            <AppButton icon={<SaveIcon />} loading={saving} onClick={handleSave}>
              Salvar alvos
            </AppButton>
          </>
        }
        metrics={
          <>
            <AppMetric label="Patrimônio" value={fmt(view.total_value)} size="lg" />
            {simulating && (
              <>
                <AppMetric label="Aporte" value={contribution ? fmt(contribution) : '—'} />
                <AppMetric label="Carteira depois" value={fmt(effectiveTotal)} />
              </>
            )}
            <AppMetric
              label="Soma dos alvos"
              value={categoryTargetSum > 0 ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%` : '—'}
              tone={categoryTargetSum > 0 && Math.abs(categoryTargetSum - 100) > 0.01 ? 'danger' : 'default'}
            />
          </>
        }
      />

      <AppGrid cols={{ xs: 1, md: 2 }} gap="lg" align="stretch">
        <AppGridItem>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Hoje</SectionTitle>
              <AllocationPie slices={pies.current} />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem>
          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>{simulating ? 'Depois do aporte' : 'No alvo'}</SectionTitle>
              <AllocationPie slices={pies.suggested} />
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      <AppCard padding="none">
        <AppSimpleTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => row.key}
          getRowSurface={(row) => (row.kind === 'category' ? 'sunken' : 'paper')}
        />
      </AppCard>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />
    </AppStack>
  )
}
