import { logout } from '@/actions/auth'
import { useAuthStore } from '@/stores/auth'

import AccountCircle from '@mui/icons-material/AccountCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MenuIcon from '@mui/icons-material/Menu'

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  AppIconButton,
  AppMenu,
  AppNavDrawer,
  AppTopbar,
  ThemeToggleButton,
  useAppTheme,
  useViewportMatches,
} from '@/components/ui'
import {
  adminNavigationSections,
  getActiveAdminPath,
  getAdminNavigationSection,
  groupAdminItems,
} from './navigation'

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

  /* Abaixo de `md` a coluna comeria a largura do conteúdo: a navegação vira o
     drawer, como na carteira. */
  const theme = useAppTheme()
  const isMobile = useViewportMatches(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(() => [activeSection.id])

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
    <AppTopbar
      navLabel="Áreas administrativas"
      sections={isMobile ? [] : adminNavigationSections.map((s) => ({ id: s.id, label: s.label }))}
      selectedSectionId={activeSection.id}
      onSelectSection={(id) => {
        const section = adminNavigationSections.find((s) => s.id === id)
        if (section) navigate(section.defaultPath)
      }}
      brand={{ label: 'Admin', onClick: () => navigate(adminNavigationSections[0].defaultPath) }}
      menuButton={
        isMobile
          ? {
              label: 'Abrir menu de navegação',
              icon: <MenuIcon />,
              onClick: () => setDrawerOpen(true),
            }
          : {
              label: railCollapsed ? 'Expandir menu' : 'Recolher menu',
              icon: railCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />,
              onClick: onToggleRail,
            }
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

    <AppNavDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      title="Admin"
      sections={adminNavigationSections.map((section) => {
        const activePath = getActiveAdminPath(section, pathname)
        return {
          id: section.id,
          label: section.label,
          active: section.id === activeSection.id,
          groups: groupAdminItems(section).map((group) => ({
            title: group.title,
            items: group.items.map((item) => ({
              id: item.path,
              label: item.label,
              active: item.path === activePath,
            })),
          })),
        }
      })}
      openSectionIds={openSectionIds}
      onToggleSection={(id) =>
        setOpenSectionIds((prev) =>
          prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
        )
      }
      onSelect={(path) => navigate(path)}
    />
    </>
  )
}
