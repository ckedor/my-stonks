import { syncAnalysis, syncBenchmarks, syncDividends, syncPatrimony, syncPortfolioData, syncPortfolios, syncPositions, syncReturns } from '@/actions/portfolio'
import GlobalTradeForm from '@/components/GlobalTradeForm'
import { AppPageShell, useAppTheme, useViewportMatches } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useCurrencyStore } from '@/stores/currency'
import { usePortfolioStore } from '@/stores/portfolio'

import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import MainSidebar from './MainSidebar'
import MainTopbar from './MainTopbar'

/**
 * Initialises the offline-first sync pipeline:
 *  1. On mount → load portfolio list from IndexedDB then revalidate
 *  2. When selectedPortfolio changes → load domain data from IndexedDB then revalidate
 */
function usePortfolioSync() {
  const selectedPortfolioId = usePortfolioStore((s) => s.selectedPortfolio?.id)
  const currency = useCurrencyStore((s) => s.currency)
  const prevCurrency = useRef(currency)

  // Sync portfolio list once on mount
  useEffect(() => {
    syncPortfolios()
  }, [])

  // Sync domain data whenever the active portfolio changes
  useEffect(() => {
    if (selectedPortfolioId) {
      syncPortfolioData(selectedPortfolioId)
    }
  }, [selectedPortfolioId])

  // Re-sync every currency-dependent dataset when currency changes (skip initial render)
  useEffect(() => {
    if (prevCurrency.current !== currency && selectedPortfolioId) {
      syncPositions(selectedPortfolioId, true)
      syncDividends(selectedPortfolioId, true)
      syncPatrimony(selectedPortfolioId, true)
      syncReturns(selectedPortfolioId, true)
      syncBenchmarks(true)
      syncAnalysis(selectedPortfolioId, true)
    }
    prevCurrency.current = currency
  }, [currency, selectedPortfolioId])
}

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

  usePortfolioSync()

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
