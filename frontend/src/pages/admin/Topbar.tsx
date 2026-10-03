import { logout } from '@/actions/auth'
import { useAuthStore } from '@/stores/auth'

import AccountCircle from '@mui/icons-material/AccountCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppIconButton, AppMenu, AppTopbar, ThemeToggleButton } from '@/components/ui'
import { adminNavigationSections, getAdminNavigationSection } from './navigation'

export default function AdminTopbar({
  railCollapsed,
  onToggleRail,
}: {
  railCollapsed: boolean
  onToggleRail: () => void
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
      brand={{ label: 'Admin', onClick: () => navigate(adminNavigationSections[0].defaultPath) }}
      menuButton={{
        label: railCollapsed ? 'Expandir menu' : 'Recolher menu',
        icon: railCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />,
        onClick: onToggleRail,
      }}
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
