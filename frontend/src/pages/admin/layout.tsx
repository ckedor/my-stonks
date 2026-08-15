import { useAuthStore } from '@/stores/auth'

import { AppShell, AppStack, AppText, PageTitle, SIDEBAR_WIDTH, useViewportMatches } from '@/components/ui'

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './Sidebar'
import AdminTopbar from './Topbar'

const COLLAPSE_MEDIA = '(max-width: 1366px)'

export default function AdminLayout() {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const collapsedMode = useViewportMatches(COLLAPSE_MEDIA)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (isLoading) return null

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  // Verifica se o usuário é admin
  if (!user?.is_admin) {
    return (
      <AppStack align="center" justify="center" gap="md" fullHeight>
        <PageTitle tone="error">Acesso Negado</PageTitle>
        <AppText>Você não tem permissão para acessar esta área administrativa.</AppText>
      </AppStack>
    )
  }

  const variant = collapsedMode ? 'persistent' : 'permanent'

  return (
    <AppShell
      sidebarOffset={variant === 'permanent' ? SIDEBAR_WIDTH : 0}
      shiftedBy={variant === 'persistent' && drawerOpen ? SIDEBAR_WIDTH : 0}
      sidebar={
        <AdminSidebar variant={variant} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      }
      topbar={
        <AdminTopbar
          showMenuButton={variant === 'persistent'}
          onMenuClick={() => setDrawerOpen((v) => !v)}
        />
      }
    >
      <Outlet />
    </AppShell>
  )
}
