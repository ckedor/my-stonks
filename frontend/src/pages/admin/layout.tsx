import { Suspense } from 'react'
import RouteSkeleton from '@/layouts/RouteSkeleton'
import { useAuthStore } from '@/stores/auth'

import { AppPageShell, AppStack, AppText, PageTitle } from '@/components/ui'
import { useNavRailCollapsed } from '@/hooks/useNavRailCollapsed'

import { Outlet } from 'react-router-dom'
import AdminSidebar from './Sidebar'
import AdminTopbar from './Topbar'

export default function AdminLayout() {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const [railCollapsed, toggleRail] = useNavRailCollapsed()

  if (isLoading) return null

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  // Verifica se o usuário é admin
  if (!user?.is_admin) {
    return (
      <AppStack align="center" justify="center" gap="md" fullHeight>
        <PageTitle tone="danger">Acesso Negado</PageTitle>
        <AppText>Você não tem permissão para acessar esta área administrativa.</AppText>
      </AppStack>
    )
  }

  /* A mesma moldura e a mesma coluna da carteira: o admin é outra área do
     mesmo app, não outro produto. */
  return (
    <AppPageShell
      sidebar={<AdminSidebar collapsed={railCollapsed} />}
      topbar={<AdminTopbar railCollapsed={railCollapsed} onToggleRail={toggleRail} />}
    >
      <Suspense fallback={<RouteSkeleton />}>
        <Outlet />
      </Suspense>
    </AppPageShell>
  )
}
