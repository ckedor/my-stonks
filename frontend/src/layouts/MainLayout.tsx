import { syncAnalysis, syncBenchmarks, syncDividends, syncPatrimony, syncPortfolioData, syncPortfolios, syncPositions, syncReturns } from '@/actions/portfolio'
import GlobalTradeForm from '@/components/GlobalTradeForm'
import { AppPageShell } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import { useCurrencyStore } from '@/stores/currency'
import { usePortfolioStore } from '@/stores/portfolio'

import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
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

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  usePortfolioSync()

  if (isLoading) return null
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return null
  }

  return (
    <>
      <AppPageShell topbar={<MainTopbar />}>
        <Outlet />
      </AppPageShell>

      {/* Fora da moldura porque é um diálogo: renderiza em portal e não
          ocupa lugar no fluxo. */}
      <GlobalTradeForm />
    </>
  )
}
