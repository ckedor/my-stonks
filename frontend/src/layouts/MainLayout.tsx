import GlobalTradeForm from '@/components/GlobalTradeForm'
import { AppPageShell, useAppTheme, useViewportMatches } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'

import { useNavRailCollapsed } from '@/hooks/useNavRailCollapsed'
import { Outlet } from 'react-router-dom'
import MainSidebar from './MainSidebar'
import MainTopbar from './MainTopbar'

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const theme = useAppTheme()
  /* Abaixo de `md` a coluna comeria a largura que resta para o gráfico: ali
     a navegação continua sendo o drawer da barra superior. */
  const isMobile = useViewportMatches(theme.breakpoints.down('md'))
  const [railCollapsed, toggleRail] = useNavRailCollapsed()

  if (isLoading) return null
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  return (
    <>
      <AppPageShell
        topbar={<MainTopbar railCollapsed={railCollapsed} onToggleRail={toggleRail} />}
        sidebar={isMobile ? undefined : <MainSidebar collapsed={railCollapsed} />}
      >
        <Outlet />
      </AppPageShell>

      {/* Fora da moldura porque é um diálogo: renderiza em portal e não
          ocupa lugar no fluxo. */}
      <GlobalTradeForm />
    </>
  )
}
