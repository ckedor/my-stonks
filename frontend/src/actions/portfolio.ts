import { fetchBenchmarks } from '@/api/market'
import { fetchPortfolioWealthTier } from '@/api/wealth-tier'
import {
    consolidatePortfolio,
    fetchAnalysis,
    fetchCategoryReturns,
    fetchDividends,
    fetchPatrimony,
    fetchPortfolios,
    fetchPositions,
    fetchReturns,
    fetchTrades
} from '@/api/portfolio'
import { useCurrencyStore } from '@/stores/currency'
import { useDataCacheStore } from '@/stores/data-cache'
import { usePortfolioStore } from '@/stores/portfolio'
import { useAnalysisStore } from '@/stores/portfolio/analysis'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import { usePositionsStore } from '@/stores/portfolio/positions'
import { useReturnsStore } from '@/stores/portfolio/returns'
import { useTradesStore } from '@/stores/portfolio/trades'
import { useWealthTierStore } from '@/stores/portfolio/wealth-tier'
import type { Portfolio, ReturnsEntry } from '@/types'
import { staleWhileRevalidate } from './sync'

// ---------------------------------------------------------------------------
// Portfolio list
// ---------------------------------------------------------------------------

export async function syncPortfolios(force = false): Promise<void> {
  await staleWhileRevalidate<Portfolio[]>({
    cacheKey: 'portfolios',
    fetcher: fetchPortfolios,
    force,
    onLoadingChange: (loading) => usePortfolioStore.setState({ loading }),
    onHydrate: (portfolios) => {
      const prev = usePortfolioStore.getState()

      // Resolve which portfolio to select
      const storedId = localStorage.getItem('selectedPortfolioId')
      const storedIdNum = storedId ? parseInt(storedId, 10) : null

      let selected: Portfolio | null = prev.selectedPortfolio

      if (!selected) {
        // First load – pick stored or first
        const found = portfolios.find((p) => p.id === storedIdNum)
        selected = found ?? portfolios[0] ?? null
      } else {
        // Refresh existing selection with potentially updated data
        const updated = portfolios.find((p) => p.id === selected!.id)
        selected = updated ?? portfolios[0] ?? null
      }

      usePortfolioStore.setState({
        portfolios,
        selectedPortfolio: selected,
        loading: false,
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export async function syncPositions(portfolioId: number, force = false): Promise<void> {
  const currency = useCurrencyStore.getState().currency
  await staleWhileRevalidate({
    cacheKey: `positions:${portfolioId}:${currency}`,
    fetcher: () => fetchPositions(portfolioId, currency),
    force,
    onLoadingChange: (loading) => usePositionsStore.setState({ loading }),
    onHydrate: (positions) => usePositionsStore.getState().setPositions(positions),
  })
}

// ---------------------------------------------------------------------------
// Returns + Benchmarks  (two independent fetches, one SWR each)
// ---------------------------------------------------------------------------

export async function syncReturns(portfolioId: number, force = false): Promise<void> {
  const store = useReturnsStore.getState()
  const portfolio = usePortfolioStore.getState().selectedPortfolio
  const currency = useCurrencyStore.getState().currency

  // 1. Fetch portfolio-level returns
  await staleWhileRevalidate({
    cacheKey: `portfolio-returns:${portfolioId}:${currency}`,
    fetcher: () => fetchReturns(portfolioId, currency),
    force,
    onLoadingChange: (loading) => useReturnsStore.setState({ loading }),
    onHydrate: (entries) => {
      const portfolioReturns: ReturnsEntry[] = entries.map((e) => ({
        date: e.date,
        value: e.acc_return,
      }))
      const lastEntry = entries.length ? entries[entries.length - 1] : null
      store.setPortfolioReturns(portfolioReturns, lastEntry?.cagr ?? null)
    },
  })

  // 2. Fetch all category returns in a single request (with SWR caching)
  const categories = portfolio?.custom_categories ?? []
  if (categories.length > 0) {
    await staleWhileRevalidate({
      cacheKey: `category-returns:${portfolioId}:${currency}`,
      fetcher: () => fetchCategoryReturns(portfolioId, undefined, undefined, currency),
      force,
      onLoadingChange: () => {},
      onHydrate: (entries) => {
        const catMap: Record<string, ReturnsEntry[]> = {}
        const cagrMap: Record<string, number | null> = {}
        for (const e of entries) {
          const name = e.category
          if (!catMap[name]) catMap[name] = []
          catMap[name].push({ date: e.date, value: e.acc_return })
          cagrMap[name] = e.cagr ?? null
        }
        store.setAllCategoryReturns(catMap, cagrMap)
      },
    })
  } else {
    store.setAllCategoryReturns({}, {})
  }
}

export async function syncBenchmarks(force = false): Promise<void> {
  const currency = useCurrencyStore.getState().currency
  const store = useReturnsStore.getState()

  if (store.benchmarkCurrency !== currency) {
    store.setBenchmarks({}, currency)
  }

  await staleWhileRevalidate({
    cacheKey: `benchmarks:${currency}`,
    fetcher: () => fetchBenchmarks(currency),
    force,
    onLoadingChange: () => {}, // benchmarks don't drive a top-level loading spinner
    onHydrate: (data) => {
      if (useCurrencyStore.getState().currency === currency) {
        useReturnsStore.getState().setBenchmarks(data, currency)
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export async function syncAnalysis(portfolioId: number, force = false): Promise<void> {
  const currency = useCurrencyStore.getState().currency
  await staleWhileRevalidate({
    cacheKey: `analysis:${portfolioId}:${currency}`,
    fetcher: () => fetchAnalysis(portfolioId, currency),
    force,
    onLoadingChange: (loading) => useAnalysisStore.setState({ loading }),
    onHydrate: (data) => useAnalysisStore.getState().setAnalysis(data),
  })
}

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------

export async function syncDividends(portfolioId: number, force = false): Promise<void> {
  const currency = useCurrencyStore.getState().currency
  await staleWhileRevalidate({
    cacheKey: `dividends:${portfolioId}:${currency}`,
    fetcher: () => fetchDividends(portfolioId, currency),
    force,
    onLoadingChange: (loading) => useDividendsStore.setState({ loading }),
    onHydrate: (data) => useDividendsStore.getState().setDividends(data),
  })
}

// ---------------------------------------------------------------------------
// Patrimony Evolution
// ---------------------------------------------------------------------------

export async function syncPatrimony(portfolioId: number, force = false): Promise<void> {
  const currency = useCurrencyStore.getState().currency
  await staleWhileRevalidate({
    cacheKey: `patrimony:${portfolioId}:${currency}`,
    fetcher: () => fetchPatrimony(portfolioId, currency),
    force,
    onLoadingChange: (loading) => usePatrimonyStore.setState({ loading }),
    onHydrate: (data) => usePatrimonyStore.getState().setPatrimony(data),
  })
}

// ---------------------------------------------------------------------------
// Trades
// ---------------------------------------------------------------------------

export async function syncTrades(portfolioId: number, force = false): Promise<void> {
  await staleWhileRevalidate({
    cacheKey: `trades:${portfolioId}`,
    fetcher: () => fetchTrades(portfolioId),
    force,
    onLoadingChange: (loading) => useTradesStore.setState({ loading }),
    onHydrate: (data) => useTradesStore.getState().setTrades(data),
  })
}

// ---------------------------------------------------------------------------
// Wealth tier
// ---------------------------------------------------------------------------

/* Sem moeda na chave, ao contrário dos vizinhos: a patente sai do patrimônio
   em BRL, então trocar o seletor de moeda não muda a resposta. */
async function syncWealthTier(portfolioId: number, force = false): Promise<void> {
  await staleWhileRevalidate({
    cacheKey: `wealth-tier:${portfolioId}`,
    fetcher: () => fetchPortfolioWealthTier(portfolioId),
    force,
    onLoadingChange: (loading) => useWealthTierStore.setState({ loading }),
    onHydrate: (data) => useWealthTierStore.getState().setStanding(data),
  })
}

// ---------------------------------------------------------------------------
// Composite: sync all data for a portfolio (non-blocking, parallel)
// ---------------------------------------------------------------------------

export function syncPortfolioData(portfolioId: number, force = false): void {
  // Fire all syncs in parallel – they never block each other
  syncPositions(portfolioId, force).catch(console.error)
  syncReturns(portfolioId, force).catch(console.error)
  syncBenchmarks(force).catch(console.error)
  syncAnalysis(portfolioId, force).catch(console.error)
  syncDividends(portfolioId, force).catch(console.error)
  syncPatrimony(portfolioId, force).catch(console.error)
  syncTrades(portfolioId, force).catch(console.error)
  syncWealthTier(portfolioId, force).catch(console.error)
}

// ---------------------------------------------------------------------------
// Force refresh: consolidate on backend then re-sync everything
// ---------------------------------------------------------------------------

export async function forceRefreshAll(portfolioId: number): Promise<void> {
  await consolidatePortfolio(portfolioId)

  // Clear page-level cache so asset-class pages refetch on next visit
  useDataCacheStore.getState().clear()

  // Force-sync all data (bypasses hash comparison)
  await Promise.all([
    syncPortfolios(true),
    syncPositions(portfolioId, true),
    syncReturns(portfolioId, true),
    syncBenchmarks(true),
    syncAnalysis(portfolioId, true),
    syncDividends(portfolioId, true),
    syncPatrimony(portfolioId, true),
    syncTrades(portfolioId, true),
    syncWealthTier(portfolioId, true),
  ])
}
