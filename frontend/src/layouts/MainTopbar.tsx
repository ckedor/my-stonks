import { logout } from '@/actions/auth'
import { forceRefreshAll } from '@/actions/portfolio'
import CategoryForm from '@/components/CategoryForm'
import DividendForm from '@/components/DividendForm'
import PortfolioForm from '@/components/PortfolioForm'
import { useAuthStore } from '@/stores/auth'
import { useFavoritesStore } from '@/stores/favorites'
import { useCurrencyStore } from '@/stores/currency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTradeFormStore } from '@/stores/trade-form'
import { useThemeMode } from '@/theme'

import AccountCircle from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import CategoryIcon from '@mui/icons-material/Category'
import CloseIcon from '@mui/icons-material/Close'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import EditIcon from '@mui/icons-material/Edit'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import LightModeIcon from '@mui/icons-material/LightMode'
import MenuIcon from '@mui/icons-material/Menu'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'

import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Select,
  Snackbar,
  Toolbar,
  Typography,
  useMediaQuery
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type Section = 'carteira' | 'mercado'

function getCurrentSection(pathname: string): Section {
  if (pathname.startsWith('/market')) return 'mercado'
  return 'carteira'
}

// Carteira nav organised into columns
const carteiraColumns = [
  {
    title: 'Visão Geral',
    items: [
      { text: 'Resumo', path: '/portfolio/overview' },
      { text: 'Ativos', path: '/portfolio/asset' },
      { text: 'Distribuição', path: '/portfolio/distribution' },
      { text: 'Patrimônio', path: '/portfolio/wealth' },
    ],
  },
  {
    title: 'Análise',
    items: [
      { text: 'Rentabilidade', path: '/portfolio/returns' },
      { text: 'Risco', path: '/portfolio/analysis' },
      { text: 'Rebalanceamento', path: '/portfolio/rebalancing' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { text: 'Trades', path: '/portfolio/trades' },
      { text: 'Proventos', path: '/portfolio/dividends' },
      { text: 'Declaração IR', path: '/portfolio/tax-income' },
    ],
  },
]

const mercadoColumns = [
  {
    title: 'Mercado',
    items: [
      { text: 'Visão geral', path: '/market/overview' },
      { text: 'Ativos', path: '/market/assets' },
    ],
  },
]

// Same nav data drives the desktop mega-menus and the mobile collapsible drawer
const navSections: { key: Section; label: string; columns: typeof carteiraColumns }[] = [
  { key: 'carteira', label: 'Carteira', columns: carteiraColumns },
  { key: 'mercado', label: 'Mercado', columns: mercadoColumns },
]

// The menu is a shortcut, not the shelf: five entries keep the column short.
const MENU_FAVORITES = 5

export default function MainTopbar() {
  const user = useAuthStore(s => s.user)
  const { portfolios, loading, selectedPortfolio, setSelectedPortfolio } = usePortfolioStore()
  const { openTradeForm } = useTradeFormStore()
  const { mode, toggleTheme } = useThemeMode()
  const currency = useCurrencyStore(s => s.currency)
  const setCurrency = useCurrencyStore(s => s.setCurrency)
  const navigate = useNavigate()
  const location = useLocation()

  const [selected, setSelected] = useState<number | null>(selectedPortfolio?.id ?? null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const [portfolioAnchorEl, setPortfolioAnchorEl] = useState<null | HTMLElement>(null)
  const portfolioMenuOpen = Boolean(portfolioAnchorEl)

  const [openForm, setOpenForm] = useState(false)
  const [editMode, setEditMode] = useState(false)

  // Section mega-menu anchors (desktop)
  const [carteiraAnchor, setCarteiraAnchor] = useState<null | HTMLElement>(null)
  const [mercadoAnchor, setMercadoAnchor] = useState<null | HTMLElement>(null)

  // Read from the store so the shortcut is drawn with the menu itself. Opening
  // refreshes the ranking behind it -- fetching first made the column appear a
  // beat late, which read as a flash every time the menu opened.
  const favorites = useFavoritesStore((state) => state.favorites).slice(0, MENU_FAVORITES)
  const refreshFavorites = useFavoritesStore((state) => state.refresh)
  useEffect(() => {
    if (mercadoAnchor) void refreshFavorites()
  }, [mercadoAnchor, refreshFavorites])
  // Mobile drawer with collapsible sections
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<Section, boolean>>(() => ({
    carteira: getCurrentSection(location.pathname) === 'carteira',
    mercado: getCurrentSection(location.pathname) === 'mercado',
  }))

  const toggleSection = (key: Section) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // Quick actions menu
  const [actionsAnchor, setActionsAnchor] = useState<null | HTMLElement>(null)

  // Quick action forms
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

  const currentSection = getCurrentSection(location.pathname)

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // Sync selected portfolio
  useEffect(() => {
    if (selectedPortfolio && selected !== selectedPortfolio.id) {
      setSelected(selectedPortfolio.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolio])

  const handleOpenCreate = () => {
    setEditMode(false)
    setOpenForm(true)
  }
  const handleOpenEdit = () => {
    setEditMode(true)
    setOpenForm(true)
  }

  const handlePortfolioSelect = (value: number) => {
    if (value === -1) {
      handleOpenEdit()
      return
    }
    if (value === -2) {
      handleOpenCreate()
      return
    }
    setSelected(value)
    const portfolio = portfolios.find((p) => p.id === value)
    if (portfolio) setSelectedPortfolio(portfolio)
  }

  // Returned as an array (not a component) so the Select isn't remounted on every render
  const renderPortfolioOptions = () => [
    ...portfolios.map((p) => (
      <MenuItem key={p.id} value={p.id}>
        {p.name}
      </MenuItem>
    )),
    <ListSubheader key="__divider">──────────</ListSubheader>,
    <MenuItem key="__edit" value={-1}>
      <Box display="flex" alignItems="center" gap={1}>
        <EditIcon sx={{ color: 'primary.main' }} fontSize="small" />
        <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>Editar Carteira</Typography>
      </Box>
    </MenuItem>,
    <MenuItem key="__create" value={-2}>
      <Box display="flex" alignItems="center" gap={1}>
        <AddIcon sx={{ color: 'primary.main' }} fontSize="small" />
        <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>Nova Carteira</Typography>
      </Box>
    </MenuItem>,
  ]


  // Mega-menu column component
  const MegaMenuContent = ({ columns, onClose }: { columns: typeof carteiraColumns; onClose: () => void }) => (
    <Box sx={{ display: 'flex', gap: 8, p: 4, minWidth: 480 }}>
      {columns.map((col) => (
        <Box key={col.title} sx={{ minWidth: 120 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.primary', letterSpacing: 0.3 }}>
            {col.title}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {col.items.map((item) => (
              <Typography
                key={item.path}
                onClick={() => { navigate(item.path); onClose() }}
                sx={{
                  py: 1,
                  px: 1.5,
                  mx: -1.5,
                  cursor: 'pointer',
                  borderRadius: 1,
                  color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                  fontWeight: isActive(item.path) ? 600 : 400,
                  fontSize: '0.9rem',
                  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                }}
              >
                {item.text}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )

  return (
    <>
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ bgcolor: 'topbar.background' }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 1600, width: '100%', mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 2 }, minWidth: 0 }}>
            {isMobile && (
              <IconButton
                edge="start"
                aria-label="Abrir menu de navegação"
                onClick={() => setDrawerOpen(true)}
                sx={{ color: 'topbar.text' }}
              >
                <MenuIcon />
              </IconButton>
            )}

            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 'bold', cursor: 'pointer', color: 'topbar.text' }}
              onClick={() => navigate('/portfolio/overview')}
            >
              My Stonks
            </Typography>

            {!isMobile && (
              <>
            <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'topbar.text', opacity: 0.3 }} />

            {/* Carteira button with underline */}
            <Button
              onClick={(e) => setCarteiraAnchor(e.currentTarget)}
              sx={{
                textTransform: 'none',
                fontWeight: currentSection === 'carteira' ? 'bold' : 'normal',
                color: 'topbar.text',
                borderBottom: currentSection === 'carteira' ? 2 : 0,
                borderColor: 'topbar.text',
                borderRadius: 0,
                px: 1.5,
              }}
            >
              Carteira
            </Button>
            <Popover
              open={Boolean(carteiraAnchor)}
              anchorEl={carteiraAnchor}
              onClose={() => setCarteiraAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              disableScrollLock
              slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } } }}
            >
              <MegaMenuContent columns={carteiraColumns} onClose={() => setCarteiraAnchor(null)} />
            </Popover>

            {/* Mercado button with underline */}
            <Button
              onClick={(e) => setMercadoAnchor(e.currentTarget)}
              sx={{
                textTransform: 'none',
                fontWeight: currentSection === 'mercado' ? 'bold' : 'normal',
                color: 'topbar.text',
                borderBottom: currentSection === 'mercado' ? 2 : 0,
                borderColor: 'topbar.text',
                borderRadius: 0,
                px: 1.5,
              }}
            >
              Mercado
            </Button>
            <Popover
              open={Boolean(mercadoAnchor)}
              anchorEl={mercadoAnchor}
              onClose={() => setMercadoAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              disableScrollLock
              slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } } }}
            >
              <Box sx={{ display: 'flex' }}>
                <MegaMenuContent columns={mercadoColumns} onClose={() => setMercadoAnchor(null)} />
                {favorites.length > 0 && (
                  <Box sx={{ py: 4, pr: 4, minWidth: 190 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 2, color: 'text.primary', letterSpacing: 0.3 }}
                    >
                      Mais acessados
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {favorites.map((asset) => (
                        <Typography
                          key={asset.id}
                          onClick={() => {
                            navigate(`/market/asset/${asset.id}`)
                            setMercadoAnchor(null)
                          }}
                          sx={{
                            py: 1,
                            px: 1.5,
                            mx: -1.5,
                            cursor: 'pointer',
                            borderRadius: 1,
                            color: 'text.secondary',
                            fontSize: '0.9rem',
                            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                          }}
                        >
                          {/* No visit count: it ranks the list, it is not
                              something the user came here to read. */}
                          <span>{asset.ticker ?? asset.name}</span>
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Popover>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              !isMobile && (
              <>
                <Button
                  onClick={(e) => setPortfolioAnchorEl(e.currentTarget)}
                  endIcon={
                    <ExpandMore
                      sx={{
                        transition: 'transform 150ms',
                        transform: portfolioMenuOpen ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  }
                  disableRipple
                  sx={{
                    // The topbar has its own palette: `inherit` resolves to the
                    // page text colour and disappears against a dark bar.
                    color: 'topbar.text',
                    textTransform: 'none',
                    fontSize: 15,
                    fontWeight: 600,
                    px: 1,
                    py: 0.25,
                    minWidth: 0,
                    borderRadius: 1.5,
                    '& .MuiButton-endIcon': { ml: 0.5, opacity: 0.7 },
                    '&:hover': { bgcolor: 'topbar.activeBg' },
                  }}
                >
                  {selectedPortfolio?.name ?? 'Carteira'}
                </Button>

                <Menu
                  anchorEl={portfolioAnchorEl}
                  open={portfolioMenuOpen}
                  onClose={() => setPortfolioAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  disableScrollLock
                  slotProps={{ paper: { sx: { minWidth: 200, mt: 0.5 } } }}
                >
                  {portfolios.map((p) => (
                    <MenuItem
                      key={p.id}
                      selected={p.id === selected}
                      onClick={() => {
                        setSelected(p.id)
                        setSelectedPortfolio(p)
                        setPortfolioAnchorEl(null)
                      }}
                    >
                      {p.name}
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem onClick={() => { setPortfolioAnchorEl(null); handleOpenEdit() }}>
                    <EditIcon sx={{ color: 'primary.main', mr: 1 }} fontSize="small" />
                    <Typography sx={{ color: 'primary.main' }}>Editar carteira</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => { setPortfolioAnchorEl(null); handleOpenCreate() }}>
                    <AddIcon sx={{ color: 'primary.main', mr: 1 }} fontSize="small" />
                    <Typography sx={{ color: 'primary.main' }}>Nova carteira</Typography>
                  </MenuItem>
                </Menu>
              </>
              )
            )}

            {/* Currency toggle */}
            <Box
              onClick={() => setCurrency(currency === 'BRL' ? 'USD' : 'BRL')}
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: 64,
                height: 28,
                borderRadius: 14,
                bgcolor: 'action.hover',
                cursor: 'pointer',
                userSelect: 'none',
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
              }}
            >
              {/* Sliding pill */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: currency === 'BRL' ? 2 : 'calc(100% - 32px - 2px)',
                  width: 32,
                  height: 22,
                  borderRadius: 11,
                  bgcolor: 'primary.main',
                  transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
              {/* Labels */}
              <Typography
                sx={{
                  position: 'relative',
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '28px',
                  color: currency === 'BRL' ? 'primary.contrastText' : 'text.secondary',
                  transition: 'color 0.2s',
                  zIndex: 1,
                }}
              >
                R$
              </Typography>
              <Typography
                sx={{
                  position: 'relative',
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '28px',
                  color: currency === 'USD' ? 'primary.contrastText' : 'text.secondary',
                  transition: 'color 0.2s',
                  zIndex: 1,
                }}
              >
                US$
              </Typography>
            </Box>

            {/* Quick actions ⋮ menu */}
            <IconButton onClick={(e) => setActionsAnchor(e.currentTarget)} sx={{ color: 'topbar.text' }}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)} disableScrollLock>
              <MenuItem onClick={() => { openTradeForm(); setActionsAnchor(null) }}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Comprar Ativo</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setOpenDividendForm(true); setActionsAnchor(null) }}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Cadastrar Dividendo</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { setOpenCategoryForm(true); setActionsAnchor(null) }}>
                <ListItemIcon><CategoryIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Editar Categorias</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleRecalculate}
                disabled={recalculating}
              >
                <ListItemIcon>
                  {recalculating ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText>{recalculating ? 'Recalculando...' : 'Recalcular Carteira'}</ListItemText>
              </MenuItem>
            </Menu>

            {/* User menu */}
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: 'topbar.text' }}>
              <AccountCircle />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} disableScrollLock>
              <MenuItem disabled>
                <Typography variant="body2">{user?.email}</Typography>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  navigate('/portfolio/user-configurations')
                  setAnchorEl(null)
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <SettingsIcon fontSize="small" />
                  <Typography>Configurações</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={() => { toggleTheme(); setAnchorEl(null) }}>
                <Box display="flex" alignItems="center" gap={1}>
                  {mode === 'dark' ? <LightModeIcon fontSize="small" sx={{ color: 'golden' }} /> : <DarkModeIcon fontSize="small" sx={{ color: 'golden' }} />}
                  <Typography>{mode === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</Typography>
                </Box>
              </MenuItem>
              {user?.is_admin && (
                <MenuItem
                  onClick={() => {
                    navigate('/admin')
                    setAnchorEl(null)
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <AdminPanelSettingsIcon fontSize="small" />
                    <Typography>Admin</Typography>
                  </Box>
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile navigation: collapsible sections in a drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 280, maxWidth: '85vw' } } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            My Stonks
          </Typography>
          <IconButton size="small" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Select
              fullWidth
              size="small"
              MenuProps={{ disableScrollLock: true }}
              value={selected ?? ''}
              onChange={(e) => handlePortfolioSelect(Number(e.target.value))}
              IconComponent={ExpandMore}
              sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
              renderValue={(value) => portfolios.find((p) => p.id === value)?.name || ''}
            >
              {renderPortfolioOptions()}
            </Select>
          )}
        </Box>

        <Divider />

        <List disablePadding>
          {navSections.map((section) => (
            <Box key={section.key}>
              <ListItemButton onClick={() => toggleSection(section.key)}>
                <ListItemText
                  primary={section.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontWeight: currentSection === section.key ? 700 : 500,
                        color: currentSection === section.key ? 'primary.main' : 'text.primary',
                      },
                    },
                  }}
                />
                {openSections[section.key] ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>

              <Collapse in={openSections[section.key]} timeout="auto" unmountOnExit>
                {section.columns.map((col) => (
                  <Box key={col.title}>
                    {/* A lone column repeating the section name adds nothing here */}
                    {!(section.columns.length === 1 && col.title === section.label) && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          px: 3,
                          pt: 1.5,
                          pb: 0.5,
                          color: 'text.secondary',
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {col.title}
                      </Typography>
                    )}
                    {col.items.map((item) => (
                      <ListItemButton
                        key={item.path}
                        onClick={() => {
                          navigate(item.path)
                          setDrawerOpen(false)
                        }}
                        sx={{ pl: 3, py: 0.75 }}
                      >
                        <ListItemText
                          primary={item.text}
                          slotProps={{
                            primary: {
                              sx: {
                                fontSize: '0.9rem',
                                fontWeight: isActive(item.path) ? 600 : 400,
                                color: isActive(item.path) ? 'primary.main' : 'text.primary',
                              },
                            },
                          }}
                        />
                      </ListItemButton>
                    ))}
                  </Box>
                ))}
              </Collapse>

              <Divider />
            </Box>
          ))}
        </List>
      </Drawer>

      <PortfolioForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        portfolio={editMode ? selectedPortfolio ?? undefined : undefined}
      />

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
