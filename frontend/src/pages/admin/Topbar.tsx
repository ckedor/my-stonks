import { logout } from '@/actions/auth'
import { useAuthStore } from '@/stores/auth'

import AccountCircle from '@mui/icons-material/AccountCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MenuIcon from '@mui/icons-material/Menu'

import {
    AppBar,
    Box,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
} from '@mui/material'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { adminNavigationSections, getAdminNavigationSection } from './navigation'

export default function AdminTopbar({
  showMenuButton = false,
  onMenuClick,
}: {
  showMenuButton?: boolean
  onMenuClick?: () => void
}) {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeSection = getAdminNavigationSection(pathname)

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleBackToPortfolio = () => {
    navigate('/portfolio/overview')
  }

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'topbar.background',
        color: 'topbar.text',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {showMenuButton && (
            <IconButton
              edge="start"
              aria-label="menu"
              onClick={onMenuClick}
              sx={{ color: 'inherit', flexShrink: 0 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            component="nav"
            aria-label="Áreas administrativas"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {adminNavigationSections.map((section) => {
              const selected = section.id === activeSection.id
              return (
                <Typography
                  key={section.id}
                  component="button"
                  type="button"
                  onClick={() => navigate(section.defaultPath)}
                  sx={{
                    appearance: 'none',
                    border: 0,
                    borderRadius: 1.5,
                    bgcolor: selected ? 'topbar.activeBg' : 'transparent',
                    color: selected ? 'topbar.activeText' : 'topbar.text',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    fontWeight: selected ? 700 : 500,
                    lineHeight: 1.5,
                    px: 1.5,
                    py: 0.75,
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      bgcolor: selected ? 'topbar.activeBg' : 'action.hover',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  }}
                >
                  {section.label}
                </Typography>
              )
            })}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
          <ThemeToggleButton />

          <IconButton
            onClick={handleBackToPortfolio}
            title="Voltar para Portfolio"
            sx={{ color: 'inherit' }}
          >
            <ArrowBackIcon />
          </IconButton>

          <IconButton
            onClick={handleMenu}
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            sx={{ color: 'inherit' }}
          >
            <AccountCircle />
          </IconButton>

          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={open}
            onClose={handleClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
