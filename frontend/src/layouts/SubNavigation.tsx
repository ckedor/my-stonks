import AddIcon from '@mui/icons-material/Add'
import CategoryIcon from '@mui/icons-material/Category'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { forceRefreshAll } from '@/actions/portfolio'
import CategoryForm from '@/components/CategoryForm'
import DividendForm from '@/components/DividendForm'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTradeFormStore } from '@/stores/trade-form'

type Section = 'carteira' | 'mercado'

interface NavItem {
  text: string
  path: string
}

interface QuickAction {
  text: string
  icon: React.ReactNode
  action: () => void
}

const carteiraNav: NavItem[] = [
  { text: 'Resumo', path: '/portfolio/overview' },
  { text: 'Ativos', path: '/portfolio/asset' },
  { text: 'Rentabilidade', path: '/portfolio/returns' },
  { text: 'Patrimônio', path: '/portfolio/wealth' },
  { text: 'Risco', path: '/portfolio/analysis' },
  { text: 'Rebalanceamento', path: '/portfolio/rebalancing' },
  { text: 'Trades', path: '/portfolio/trades' },
  { text: 'Proventos', path: '/portfolio/dividends' },
  { text: 'Declaração IR', path: '/portfolio/tax-income' },
]

const mercadoNav: NavItem[] = [
  { text: 'Visão geral', path: '/market/overview' },
  { text: 'Ativos', path: '/market/assets' },
]

interface SubNavigationProps {
  section: Section
}

export default function SubNavigation({ section }: SubNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const { openTradeForm } = useTradeFormStore()

  const [openDividendForm, setOpenDividendForm] = useState(false)
  const [openCategoryForm, setOpenCategoryForm] = useState(false)

  // Recalculate state
  const [recalculating, setRecalculating] = useState(false)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')

  const handleRecalculate = async () => {
    if (!selectedPortfolio) return
    setRecalculating(true)
    try {
      await forceRefreshAll(selectedPortfolio.id)
      setSnackbarMessage('Posições recalculadas com sucesso.')
      setSnackbarSeverity('success')
      setSnackbarOpen(true)
    } catch (err) {
      console.error(err)
      setSnackbarMessage('Erro ao recalcular posições.')
      setSnackbarSeverity('error')
      setSnackbarOpen(true)
    } finally {
      setRecalculating(false)
    }
  }

  const navItems = section === 'carteira' ? carteiraNav : mercadoNav

  const quickActions: QuickAction[] =
    section === 'carteira'
      ? [
          { text: 'Comprar Ativo', icon: <AddIcon fontSize="small" />, action: () => openTradeForm() },
          { text: 'Cadastrar Dividendo', icon: <AddIcon fontSize="small" />, action: () => setOpenDividendForm(true) },
          { text: 'Editar Categorias', icon: <CategoryIcon fontSize="small" />, action: () => setOpenCategoryForm(true) },
        ]
      : []

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'))
  const [actionsAnchor, setActionsAnchor] = useState<null | HTMLElement>(null)
  const actionsOpen = Boolean(actionsAnchor)

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1600,
          width: '100%',
          mx: 'auto',
          px: { xs: 1, md: 4 },
          py: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              onClick={() => navigate(item.path)}
              variant={isActive(item.path) ? 'contained' : 'text'}
              size="small"
              sx={{
                textTransform: 'none',
                fontWeight: isActive(item.path) ? 'bold' : 'normal',
                px: 1.5,
                py: 0.5,
                minWidth: 'auto',
                fontSize: '0.8125rem',
              }}
            >
              {item.text}
            </Button>
          ))}
        </Box>

        {quickActions.length > 0 && !isSmallScreen && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            {quickActions.map((action) => (
              <Chip
                key={action.text}
                label={action.text}
                icon={action.icon as React.ReactElement}
                onClick={action.action}
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer' }}
              />
            ))}
            <Chip
              label={recalculating ? 'Recalculando...' : 'Recalcular Carteira'}
              icon={recalculating ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
              onClick={handleRecalculate}
              variant="outlined"
              size="small"
              disabled={recalculating}
              sx={{ cursor: recalculating ? 'default' : 'pointer' }}
            />
          </Box>
        )}

        {quickActions.length > 0 && isSmallScreen && (
          <>
            <IconButton size="small" onClick={(e) => setActionsAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={actionsAnchor} open={actionsOpen} onClose={() => setActionsAnchor(null)}>
              {quickActions.map((action) => (
                <MenuItem key={action.text} onClick={() => { action.action(); setActionsAnchor(null) }}>
                  <ListItemIcon>{action.icon}</ListItemIcon>
                  <ListItemText>{action.text}</ListItemText>
                </MenuItem>
              ))}
              <MenuItem onClick={handleRecalculate} disabled={recalculating}>
                <ListItemIcon>{recalculating ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}</ListItemIcon>
                <ListItemText>{recalculating ? 'Recalculando...' : 'Recalcular Carteira'}</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
      </Box>

      <DividendForm open={openDividendForm} onClose={() => setOpenDividendForm(false)} />
      <CategoryForm open={openCategoryForm} onClose={() => setOpenCategoryForm(false)} />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  )
}
