import { CATEGORY_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MiniDonut from '@/components/ui/MiniDonut'
import AssetCard from '@/components/portfolio-asset/AssetCard'

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

interface AssetListProps {
  positions: Position[]
  groupBy?: 'category' | 'asset' | 'type' | 'class' | 'broker'
  onGroupByChange?: (groupBy: 'category' | 'asset' | 'type' | 'class' | 'broker') => void
}

const GRID_COLS = '40px 1.8fr 0.8fr 0.8fr 1fr 1fr 1fr 1fr 160px'

type ViewMode = 'list' | 'card'

const VIEW_STORAGE_KEY = 'my-stonks:asset-list-view'

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

  const theme = useTheme()
  const negativeColor = theme.palette.error.main
  const positiveColor = theme.palette.success.main

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

  const fmtBRL = (v: number) => formatCurrency(v)

  const pctColor = (v: number | null | undefined) =>
    v == null ? theme.palette.text.primary : v > 0 ? positiveColor : v < 0 ? negativeColor : theme.palette.text.primary

  return (
    <Box>
      {/* Toolbar */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2} alignItems="center">
        <TextField
          label="Buscar Ativo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ minWidth: 400 }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Agrupar</InputLabel>
          <Select
            value={groupBy}
            label="Agrupar"
            onChange={(e) => {
              onGroupByChange?.(e.target.value as typeof groupBy)
            }}
          >
            <MenuItem value="category">Categoria Usuário</MenuItem>
            <MenuItem value="asset">Ativo</MenuItem>
            <MenuItem value="type">Produto</MenuItem>
            <MenuItem value="class">Classe</MenuItem>
            <MenuItem value="broker">Corretora</MenuItem>
          </Select>
        </FormControl>
        <Stack sx={{ flexGrow: 1 }} direction="row" justifyContent="flex-end" spacing={2} alignItems="center">
          <DatePicker
            label="Data"
            value={selectedDate}
            onChange={(newValue) => setSelectedDate(newValue)}
            slotProps={{ textField: { size: 'small' } }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, next: ViewMode | null) => next && setView(next)}
          >
            <ToggleButton value="list" sx={{ px: 1, py: 0.5 }}>
              <Tooltip title="Lista">
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="card" sx={{ px: 1, py: 0.5 }}>
              <Tooltip title="Cards">
                <GridViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Grid list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {sortedGrouped.map(([category, items]) => {
          const groupTotal = items.reduce((a, c) => a + c.value, 0)
          const catColor = categoryColorMap[category] ?? theme.palette.primary.main

          return (
            <Box key={category}>
              {/* Group header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 1,
                  pb: 0.75,
                  borderBottom: `2px solid ${catColor}`,
                }}
              >
                <Box sx={{ width: 6, height: 20, borderRadius: 1, bgcolor: catColor, flexShrink: 0 }} />
                {groupBy === 'category' && categoryIdMap[category] != null ? (
                  <Typography
                    variant="subtitle2"
                    onClick={() => navigate(`/portfolio/category/${categoryIdMap[category]}`)}
                    sx={{
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      flex: 1,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {category}
                  </Typography>
                ) : (
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', flex: 1 }}>
                    {category}
                  </Typography>
                )}
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {formatCurrency(groupTotal)}
                </Typography>
              </Box>

              {view === 'card' ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(3, minmax(0, 1fr))',
                      xl: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 2,
                    mt: 1.5,
                  }}
                >
                  {items.map((pos) => (
                    <AssetCard
                      key={pos.asset_id}
                      position={pos}
                      portfolioId={selectedPortfolio!.id}
                      weight={totalPortfolioValue > 0 ? (pos.value / totalPortfolioValue) * 100 : 0}
                      accentColor={catColor}
                    />
                  ))}
                </Box>
              ) : (
              <>
              {/* Column headers */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLS,
                  gap: 1,
                  px: 1,
                  py: 0.5,
                  color: 'text.secondary',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                <Box />
                <Box>Ativo</Box>
                <Box sx={{ textAlign: 'right' }}>Quantidade</Box>
                <Box sx={{ textAlign: 'right' }}>Preço Unit.</Box>
                <Box sx={{ textAlign: 'right' }}>Valor Total</Box>
                <Box sx={{ textAlign: 'right' }}>Investido</Box>
                <Box sx={{ textAlign: 'right' }}>CAGR</Box>
                <Box sx={{ textAlign: 'right' }}>Lucro</Box>
                <Box>Categoria</Box>
              </Box>

              {/* Asset rows */}
              {items.map((pos) => {
                const pct = totalPortfolioValue > 0 ? (pos.value / totalPortfolioValue) * 100 : 0
                const invested = pos.total_invested ?? 0
                const profit = pos.value - invested
                const profitPct = invested > 0 ? (profit / invested) * 100 : null

                return (
                  <Box
                    key={pos.asset_id}
                    onClick={() => navigate(`/portfolio/asset/${pos.asset_id}`)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLS,
                      gap: 1,
                      px: 1,
                      py: 1,
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: 1,
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {/* Mini donut */}
                    <MiniDonut value={pct} color={catColor} />

                    {/* Name + ticker + type */}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
                        {pos.name || pos.ticker}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', lineHeight: 1.2 }}
                        noWrap
                      >
                        {pos.ticker} · {pos.type}
                      </Typography>
                    </Box>

                    {/* Quantity */}
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>
                      {pos.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                    </Typography>

                    {/* Unit price */}
                    <Typography variant="body2" sx={{ textAlign: 'right' }}>
                      {fmtBRL(pos.price)}
                    </Typography>

                    {/* Total value */}
                    <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmtBRL(pos.value)}
                    </Typography>

                    {/* Invested */}
                    <Typography variant="body2" sx={{ textAlign: 'right', color: 'text.secondary' }}>
                      {invested > 0 ? fmtBRL(invested) : '—'}
                    </Typography>

                    {/* CAGR */}
                    <Typography
                      variant="body2"
                      sx={{ textAlign: 'right', fontWeight: 600, color: pctColor(pos.cagr != null ? pos.cagr : null) }}
                    >
                      {pos.cagr != null ? `${fmtBRL(pos.cagr * 100)}%` : '—'}
                    </Typography>

                    {/* Profit */}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: pctColor(profit) }}>
                        {invested > 0 ? fmtBRL(profit) : '—'}
                      </Typography>
                      {profitPct != null && (
                        <Typography
                          variant="caption"
                          sx={{ color: pctColor(profitPct), lineHeight: 1 }}
                        >
                          {profitPct > 0 ? '+' : ''}{fmtBRL(profitPct)}%
                        </Typography>
                      )}
                    </Box>

                    {/* Category select */}
                    <FormControl size="small" fullWidth onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={userCategories.find((c) => c.name === pos.category)?.id ?? ''}
                        onChange={(e) => handleCategoryChange(pos.asset_id, Number(e.target.value))}
                        displayEmpty
                        sx={{ fontSize: 12 }}
                      >
                        <MenuItem value="">
                          <em>(Sem categoria)</em>
                        </MenuItem>
                        {userCategories.map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )
              })}
              </>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Category change confirmation dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, assetId: null, categoryId: null })}
      >
        <DialogTitle>Confirmar Alteração</DialogTitle>
        <DialogContent>
          <DialogContentText>Deseja realmente alterar a categoria deste ativo?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, assetId: null, categoryId: null })}>
            Cancelar
          </Button>
          <Button onClick={confirmCategoryChange} variant="contained" color="primary" autoFocus>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarOpen(false)}>
          Erro ao atualizar categoria.
        </Alert>
      </Snackbar>
    </Box>
  )
}
