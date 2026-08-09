
import { logout } from '@/actions/auth'
import { syncPortfolios } from '@/actions/portfolio'
import PortfolioForm from '@/components/PortfolioForm'
import { useAuthStore } from '@/stores/auth'
import { usePortfolioStore } from '@/stores/portfolio'

import AccountCircle from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMore from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'

import {
    AppBar,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Typography
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import RecalculatePortfolioButton from '@/components/RecalculatePortfolioButton'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'

export default function Topbar({
  showMenuButton = false,
  onMenuClick,
}: {
  showMenuButton?: boolean
  onMenuClick?: () => void
}) {
  const user = useAuthStore(s => s.user)
  const { portfolios, loading, selectedPortfolio, setSelectedPortfolio } =
    usePortfolioStore()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<number | null>(selectedPortfolio?.id ?? null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const [portfolioAnchorEl, setPortfolioAnchorEl] = useState<null | HTMLElement>(null)
  const portfolioMenuOpen = Boolean(portfolioAnchorEl)
  const [openForm, setOpenForm] = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    if (selectedPortfolio && selected !== selectedPortfolio.id) {
      setSelected(selectedPortfolio.id)
    }
  }, [selectedPortfolio])

  const handleOpenCreate = () => { setEditMode(false); setOpenForm(true) }
  const handleOpenEdit = () => { setEditMode(true); setOpenForm(true) }

  return (
    <>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 48 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1}}>
            {showMenuButton && (
              <IconButton edge="start" aria-label="menu" onClick={onMenuClick}>
                <MenuIcon />
              </IconButton>
            )}

          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ThemeToggleButton />
            {loading ? (
              <CircularProgress size={24} />
            ) : (
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
                  color: 'inherit',
                  textTransform: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  px: 1,
                  py: 0.25,
                  minWidth: 0,
                  borderRadius: 1.5,
                  '& .MuiButton-endIcon': { ml: 0.5, opacity: 0.6 },
                  '&:hover': { bgcolor: 'action.hover' },
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

              <RecalculatePortfolioButton />
              </>
            )}

            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <AccountCircle />
            </IconButton>
            <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled>{user?.email}</MenuItem>
              <Divider />
              {user?.is_admin && (
                <MenuItem onClick={() => { setAnchorEl(null); navigate('/admin/assets'); }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AdminPanelSettingsIcon fontSize="small" />
                    Painel Administrativo
                  </Box>
                </MenuItem>
              )}
              <MenuItem onClick={logout}>Sair</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <PortfolioForm
        open={openForm}
        onClose={() => setOpenForm(false)}
        onSave={(newId) => { syncPortfolios(true); setSelected(newId ?? null); setOpenForm(false) }}
        portfolio={editMode ? (selectedPortfolio ?? undefined) : undefined}
      />
    </>
  )
}
