import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import { useCallback, useEffect, useState } from 'react'

import {
  AppAlert,
  AppButton,
  AppCard,
  AppColorSwatch,
  AppIconButton,
  AppMetric,
  AppNumberField,
  AppPageHeader,
  AppSimpleTable,
  AppSnackbar,
  AppStack,
  AppText,
  LoadingSpinner,
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

const fmtPct = (v: number | null) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—'

/* Categoria, ativo e total moram na mesma tabela porque são a mesma leitura em
 * três níveis: quanto há, quanto se quer, quanto falta. A categoria abre e
 * fecha; o ativo só aparece com a categoria aberta; o total fecha a conta. */
type Row =
  | { kind: 'category'; key: string; category: CategoryRebalancingEntry }
  | { kind: 'asset'; key: string; categoryId: number; asset: AssetRebalancingEntry; targetSet: boolean }
  | { kind: 'total'; key: string }

/** O sinal de uma diferença, lido como o resto do app lê retorno. */
const diffTone = (v: number | null): 'success' | 'danger' | 'default' =>
  v == null || v === 0 ? 'default' : v > 0 ? 'success' : 'danger'

export default function RebalancingPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const { format: fmt, symbol: currencySymbol } = useCurrency()

  const portfolioId = selectedPortfolio?.id

  const { data: fetchedData } = useCachedData<RebalancingResponse>(
    portfolioId ? `rebalancing:${portfolioId}` : null,
    useCallback(() => api.get<RebalancingResponse>(REBALANCING_ROUTES.byPortfolio(portfolioId!)).then(r => r.data), [portfolioId]),
    { enabled: !!portfolioId },
  )

  const [data, setData] = useState<RebalancingResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [contribution, setContribution] = useState<number | null>(null)
  const [openCategories, setOpenCategories] = useState<number[]>([])

  // Sync fetched data into local state for editing
  useEffect(() => {
    if (fetchedData) setData(fetchedData)
  }, [fetchedData])

  const loading = !fetchedData && !!portfolioId

  const effectiveTotal = (data?.total_value ?? 0) + (contribution ?? 0)

  // ── Recalculate all diffs given an effective total ─────────────────
  const recalcAllDiffs = useCallback(
    (d: RebalancingResponse, total: number): RebalancingResponse => ({
      ...d,
      categories: d.categories.map((cat) => {
        const target_pct = cat.target_pct
        const target_value = target_pct != null ? (total * target_pct) / 100 : null
        const diff_pct = target_pct != null ? target_pct - cat.current_pct : null
        const diff_value = target_value != null ? target_value - cat.current_value : null

        const assets = cat.assets.map((a) => {
          if (a.target_pct_in_category != null && target_value != null) {
            const asset_target_value = (target_value * a.target_pct_in_category) / 100
            return {
              ...a,
              target_value: Math.round(asset_target_value * 100) / 100,
              diff_value: Math.round((asset_target_value - a.current_value) * 100) / 100,
              diff_pct:
                Math.round((a.target_pct_in_category - a.current_pct_in_category) * 100) / 100,
            }
          }
          return { ...a, target_value: null, diff_value: null, diff_pct: null }
        })

        return {
          ...cat,
          target_pct,
          target_value: target_value != null ? Math.round(target_value * 100) / 100 : null,
          diff_pct: diff_pct != null ? Math.round(diff_pct * 100) / 100 : null,
          diff_value: diff_value != null ? Math.round(diff_value * 100) / 100 : null,
          assets,
        }
      }),
    }),
    []
  )

  // ── Local edits ────────────────────────────────────────────────────
  const handleCategoryTargetChange = (categoryId: number, value: number | null) => {
    if (!data) return
    const updated: RebalancingResponse = {
      ...data,
      categories: data.categories.map((cat) => {
        if (cat.category_id !== categoryId) return cat
        return { ...cat, target_pct: value }
      }),
    }
    setData(recalcAllDiffs(updated, effectiveTotal))
  }

  const handleAssetTargetChange = (
    categoryId: number,
    assetId: number,
    value: number | null
  ) => {
    if (!data) return
    const updated: RebalancingResponse = {
      ...data,
      categories: data.categories.map((cat) => {
        if (cat.category_id !== categoryId) return cat
        return {
          ...cat,
          assets: cat.assets.map((a) =>
            a.asset_id === assetId ? { ...a, target_pct_in_category: value } : a
          ),
        }
      }),
    }
    setData(recalcAllDiffs(updated, effectiveTotal))
  }

  // Recalculate diffs when contribution changes
  useEffect(() => {
    if (!data) return
    setData((prev) => (prev ? recalcAllDiffs(prev, (prev.total_value) + (contribution ?? 0)) : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contribution, recalcAllDiffs])

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
  const categoryTargetSum = data
    ? data.categories.reduce((s, c) => s + (c.target_pct ?? 0), 0)
    : 0

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingSpinner />
  }

  if (!data || data.categories.length === 0) {
    return <AppAlert severity="info">Nenhuma posição encontrada para rebalanceamento.</AppAlert>
  }

  const rows: Row[] = [
    ...data.categories.flatMap<Row>((category) => {
      const open = openCategories.includes(category.category_id)
      const categoryRow: Row = {
        kind: 'category',
        key: `cat-${category.category_id}`,
        category,
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
              <AppColorSwatch color={row.category.color} shape="dot" />
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
          ? fmt(data.total_value)
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
    {
      label: 'Aporte',
      align: 'right',
      render: (row) => {
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
            <AppNumberField
              label="Simular Aporte"
              size="md"
              allowEmpty
              step={0.01}
              prefix={currencySymbol}
              value={contribution}
              onChange={setContribution}
            />
            <AppButton icon={<SaveIcon />} loading={saving} onClick={handleSave}>
              Salvar alvos
            </AppButton>
          </>
        }
        metrics={
          <>
            <AppMetric label="Patrimônio" value={fmt(data.total_value)} size="lg" />
            <AppMetric
              label="Aporte simulado"
              value={contribution ? fmt(contribution) : '—'}
            />
            <AppMetric label="Base do cálculo" value={fmt(effectiveTotal)} />
            <AppMetric
              label="Soma dos alvos"
              value={categoryTargetSum > 0 ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%` : '—'}
              tone={categoryTargetSum > 0 && Math.abs(categoryTargetSum - 100) > 0.01 ? 'danger' : 'default'}
            />
          </>
        }
      />

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
