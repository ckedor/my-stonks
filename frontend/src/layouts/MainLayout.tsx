import GlobalTradeForm from '@/components/GlobalTradeForm'
import { AppPageShell, useAppTheme, useViewportMatches } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import MainSidebar from './MainSidebar'
import MainTopbar from './MainTopbar'

const COLLAPSED_KEY = 'nav-rail-collapsed'

/* Recolhida ou expandida é preferência de quem usa, e uma que se percebe toda
   vez que a tela abre: sem guardar, a coluna volta larga a cada recarga e o
   ajuste precisa ser refeito. `localStorage` pode não existir (navegador com
   armazenamento bloqueado), e cair para o padrão é resposta suficiente — não
   vale derrubar a tela por causa disso. */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const theme = useAppTheme()
  /* Abaixo de `md` a coluna comeria a largura que resta para o gráfico: ali
     a navegação continua sendo o drawer da barra superior. */
  const isMobile = useViewportMatches(theme.breakpoints.down('md'))
  const [railCollapsed, setRailCollapsed] = useState(readCollapsed)

  const toggleRail = () =>
    setRailCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(!value))
      } catch {
        /* Preferência é conforto, não dado: perder não muda o que a tela faz. */
      }
      return !value
    })

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
