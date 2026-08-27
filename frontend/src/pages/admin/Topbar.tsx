import { logout } from '@/actions/auth'
import { useAuthStore } from '@/stores/auth'

import AccountCircle from '@mui/icons-material/AccountCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MenuIcon from '@mui/icons-material/Menu'

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppIconButton, AppMenu, AppTopbar, ThemeToggleButton } from '@/components/ui'
import { adminNavigationSections, getAdminNavigationSection } from './navigation'

export default function AdminTopbar({
  showMenuButton = false,
  onMenuClick,
}: {
  showMenuButton?: boolean
  onMenuClick?: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeSection = getAdminNavigationSection(pathname)

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AppTopbar
      navLabel="Áreas administrativas"
      sections={adminNavigationSections.map((s) => ({ id: s.id, label: s.label }))}
      selectedSectionId={activeSection.id}
      onSelectSection={(id) => {
        const section = adminNavigationSections.find((s) => s.id === id)
        if (section) navigate(section.defaultPath)
      }}
      menuButton={
        showMenuButton
          ? {
              label: 'Abrir menu de navegação',
              icon: <MenuIcon />,
              onClick: () => onMenuClick?.(),
            }
          : undefined
      }
    >
      <ThemeToggleButton />

      <AppIconButton
        label="Voltar para Portfolio"
        tone="inherit"
        onClick={() => navigate('/portfolio/overview')}
      >
        <ArrowBackIcon />
      </AppIconButton>

      <AppIconButton
        label="Conta do usuário"
        tone="inherit"
        size="lg"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <AccountCircle />
      </AppIconButton>

      <AppMenu
        id="menu-appbar"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        options={[
          { label: user?.email ?? '', disabled: true },
          { label: 'Logout', onSelect: handleLogout },
        ]}
      />
    </AppTopbar>
  )
}
