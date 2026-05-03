import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SaveIcon from '@mui/icons-material/Save'
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Collapse,
    IconButton,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
    useTheme,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'

import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { REBALANCING_ROUTES } from '@/constants/routes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePageTitleStore } from '@/stores/page-title'
import { usePortfolioStore } from '@/stores/portfolio'
import type {
    AssetRebalancingEntry,
    CategoryRebalancingEntry,
    RebalancingResponse,
} from '@/types'

// ── Column widths ────────────────────────────────────────────────────
// Shared between outer table, nested asset table and header so columns stay aligned.
const COL_WIDTHS = ['auto', 160, 100, 120, 100, 120] as const

// ── Helpers ──────────────────────────────────────────────────────────
let _fmtCurrency: (v: number) => string = (v) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmt = (v: number) => _fmtCurrency(v)

const fmtPct = (v: number | null) =>
  v != null ? `${v.toFixed(2).replace('.', ',')}%` : '—'

// ── Asset Row ────────────────────────────────────────────────────────
interface AssetRowProps {
  asset: AssetRebalancingEntry
  categoryTargetSet: boolean
  onTargetChange: (assetId: number, value: number | null) => void
}

function AssetRow({ asset, categoryTargetSet, onTargetChange }: AssetRowProps) {
  const theme = useTheme()
  const color = (v: number | null) => {
    if (v == null) return undefined
    return v > 0 ? theme.palette.success.main : v < 0 ? theme.palette.error.main : undefined
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onTargetChange(asset.asset_id, null)
      return
    }
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) onTargetChange(asset.asset_id, parsed)
  }

  return (
    <TableRow sx={{ '& td': { py: 1, px: 1.5, fontSize: 13 } }}>
      <TableCell sx={{ pl: 5, width: COL_WIDTHS[0] }}>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <span style={{ fontWeight: 'bold' }}>{asset.ticker}</span>
          {asset.name && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {asset.name}
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ width: COL_WIDTHS[1] }}>{fmt(asset.current_value)}</TableCell>
      <TableCell align="right" sx={{ width: COL_WIDTHS[2] }}>{fmtPct(asset.current_pct_in_category)}</TableCell>
      <TableCell align="right" sx={{ width: COL_WIDTHS[3] }}>
        <TextField
          size="small"
          type="number"
          value={asset.target_pct_in_category ?? ''}
          onChange={handleChange}
          slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
          sx={{
            width: 90,
            '& input': { textAlign: 'right', py: 0.5, fontSize: 13 },
            '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            '& input[type=number]': {
              MozAppearance: 'textfield',
            },
          }}
        />
      </TableCell>
      <TableCell align="right" sx={{ width: COL_WIDTHS[4], color: color(asset.diff_pct) }}>
        {categoryTargetSet ? fmtPct(asset.diff_pct) : '—'}
      </TableCell>
      <TableCell align="right" sx={{ width: COL_WIDTHS[5], color: color(asset.diff_value) }}>
        {categoryTargetSet && asset.diff_value != null ? fmt(asset.diff_value) : '—'}
      </TableCell>
    </TableRow>
  )
}

// ── Category Row (collapsible) ───────────────────────────────────────
interface CategorySectionProps {
  category: CategoryRebalancingEntry
  onCategoryTargetChange: (categoryId: number, value: number | null) => void
  onAssetTargetChange: (categoryId: number, assetId: number, value: number | null) => void
}

function CategorySection({
  category,
  onCategoryTargetChange,
  onAssetTargetChange,
}: CategorySectionProps) {
  const [open, setOpen] = useState(false)
  const theme = useTheme()

  const color = (v: number | null) => {
    if (v == null) return undefined
    return v > 0 ? theme.palette.success.main : v < 0 ? theme.palette.error.main : undefined
  }

  const categoryTargetSet = category.target_pct != null

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onCategoryTargetChange(category.category_id, null)
      return
    }
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) onCategoryTargetChange(category.category_id, parsed)
  }

  return (
    <>
      <TableRow
        sx={{
          bgcolor: 'action.hover',
          '& td': { py: 1.2, px: 1.5, fontSize: 14, fontWeight: 'bold' },
        }}
      >
        <TableCell sx={{ width: COL_WIDTHS[0] }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: category.color,
                flexShrink: 0,
              }}
            />
            <span>{category.category_name}</span>
          </Stack>
        </TableCell>
        <TableCell align="right" sx={{ width: COL_WIDTHS[1] }}>{fmt(category.current_value)}</TableCell>
        <TableCell align="right" sx={{ width: COL_WIDTHS[2] }}>{fmtPct(category.current_pct)}</TableCell>
        <TableCell align="right" sx={{ width: COL_WIDTHS[3] }}>
          <TextField
            size="small"
            type="number"
            value={category.target_pct ?? ''}
            onChange={handleCategoryChange}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }}
            sx={{
              width: 90,
              '& input': { textAlign: 'right', py: 0.5, fontSize: 13 },
              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0,
              },
              '& input[type=number]': {
                MozAppearance: 'textfield',
              },
            }}
          />
        </TableCell>
        <TableCell align="right" sx={{ width: COL_WIDTHS[4], color: color(category.diff_pct) }}>
          {fmtPct(category.diff_pct)}
        </TableCell>
        <TableCell align="right" sx={{ width: COL_WIDTHS[5], color: color(category.diff_value) }}>
          {category.diff_value != null ? fmt(category.diff_value) : '—'}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableBody>
                {category.assets.map((asset) => (
                  <AssetRow
                    key={asset.asset_id}
                    asset={asset}
                    categoryTargetSet={categoryTargetSet}
                    onTargetChange={(assetId, value) =>
                      onAssetTargetChange(category.category_id, assetId, value)
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ── Main Page ────────────────────────────────────────────────────────
export default function RebalancingPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const { setTitle } = usePageTitleStore()
  const { format: formatCurrency, symbol: currencySymbol } = useCurrency()
  _fmtCurrency = formatCurrency

  const portfolioId = selectedPortfolio?.id

  const { data: fetchedData } = useCachedData<RebalancingResponse>(
    portfolioId ? `rebalancing:${portfolioId}` : null,
    useCallback(() => api.get<RebalancingResponse>(REBALANCING_ROUTES.byPortfolio(portfolioId!)).then(r => r.data), [portfolioId]),
    { enabled: !!portfolioId },
  )

  const [data, setData] = useState<RebalancingResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [contribution, setContribution] = useState<number | null>(null)

  // Sync fetched data into local state for editing
  useEffect(() => {
    if (fetchedData) setData(fetchedData)
  }, [fetchedData])

  const loading = !fetchedData && !!portfolioId

  const showLoading = loading

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

  useEffect(() => {
    setTitle('Rebalanceamento')
    if (selectedPortfolio) setTitle(`Rebalanceamento - ${selectedPortfolio.name}`)
  }, [selectedPortfolio, setTitle])

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
  if (showLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <Box mt={4}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (!data || data.categories.length === 0) {
    return (
      <Box mt={4}>
        <Alert severity="info">
          Nenhuma posição encontrada para rebalanceamento.
        </Alert>
      </Box>
    )
  }

  return (
    <Box maxWidth={{ xs: '100%', lg: 1400 }} mx="auto" pt={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Valor total da carteira:{' '}
            <strong>{fmt(data.total_value)}</strong>
            {contribution != null && contribution > 0 && (
              <> + aporte {fmt(contribution)} = <strong>{fmt(effectiveTotal)}</strong></>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            label="Simular Aporte"
            type="number"
            value={contribution ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') { setContribution(null); return }
              const parsed = parseFloat(raw)
              if (!isNaN(parsed)) setContribution(parsed)
            }}
            placeholder={`${currencySymbol} 0,00`}
            sx={{
              width: 180,
              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0,
              },
              '& input[type=number]': {
                MozAppearance: 'textfield',
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Salvar Targets
          </Button>
        </Stack>
      </Stack>

      <AppCard noPadding>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[0] }}>
                <strong>Categoria / Ativo</strong>
              </TableCell>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[1] }} align="right">
                <strong>Valor Atual</strong>
              </TableCell>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[2] }} align="right">
                <strong>% Atual</strong>
              </TableCell>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[3] }} align="right">
                <strong>% Alvo</strong>
              </TableCell>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[4] }} align="right">
                <strong>Dif. %</strong>
              </TableCell>
              <TableCell sx={{ py: 1.3, px: 1.5, fontSize: 14, width: COL_WIDTHS[5] }} align="right">
                <strong>Aporte</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.categories.map((cat) => (
              <CategorySection
                key={cat.category_id}
                category={cat}
                onCategoryTargetChange={handleCategoryTargetChange}
                onAssetTargetChange={handleAssetTargetChange}
              />
            ))}

            {/* Total row */}
            <TableRow sx={{ '& td': { py: 1.3, px: 1.5, fontWeight: 'bold', fontSize: 14 } }}>
              <TableCell sx={{ width: COL_WIDTHS[0] }}>Total</TableCell>
              <TableCell align="right" sx={{ width: COL_WIDTHS[1] }}>{fmt(data.total_value)}</TableCell>
              <TableCell align="right" sx={{ width: COL_WIDTHS[2] }}>100,00%</TableCell>
              <TableCell align="right" sx={{ width: COL_WIDTHS[3] }}>
                {categoryTargetSum > 0
                  ? `${categoryTargetSum.toFixed(2).replace('.', ',')}%`
                  : '—'}
              </TableCell>
              <TableCell align="right" sx={{ width: COL_WIDTHS[4] }}>—</TableCell>
              <TableCell align="right" sx={{ width: COL_WIDTHS[5] }}>—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AppCard>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
