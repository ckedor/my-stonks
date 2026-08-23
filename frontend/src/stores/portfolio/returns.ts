import type { Currency } from '@/stores/currency'
import type { ReturnsEntry } from '@/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ReturnsState {
  categoryReturns: Record<string, ReturnsEntry[]>
  categoryCagr: Record<string, number | null>
  assetReturns: Record<string, ReturnsEntry[]>
  benchmarks: Record<string, ReturnsEntry[]>
  benchmarkCurrency: Currency | null
  loading: boolean

  setPortfolioReturns: (returns: ReturnsEntry[], cagr?: number | null) => void
  setCategoryReturns: (name: string, returns: ReturnsEntry[]) => void
  setAllCategoryReturns: (categories: Record<string, ReturnsEntry[]>, cagrs?: Record<string, number | null>) => void
  addAssetReturns: (assetReturns: Record<string, ReturnsEntry[]>) => void
  setBenchmarks: (benchmarks: Record<string, ReturnsEntry[]>, currency: Currency) => void
  setLoading: (loading: boolean) => void
}

export const useReturnsStore = create<ReturnsState>()(
  persist(
    (set) => ({
      categoryReturns: {},
      categoryCagr: {},
      assetReturns: {},
      benchmarks: {},
      benchmarkCurrency: null,
      loading: true,

      setPortfolioReturns: (returns, cagr) =>
        set((state) => ({
          categoryReturns: { ...state.categoryReturns, portfolio: returns },
          categoryCagr: { ...state.categoryCagr, portfolio: cagr ?? null },
          loading: false,
        })),
      setCategoryReturns: (name, returns) =>
        set((state) => ({
          categoryReturns: { ...state.categoryReturns, [name]: returns },
        })),
      setAllCategoryReturns: (categories, cagrs) =>
        set((state) => {
          const portfolioReturns = state.categoryReturns.portfolio
          const portfolioCagr = state.categoryCagr.portfolio

          return {
            categoryReturns: {
              ...(portfolioReturns ? { portfolio: portfolioReturns } : {}),
              ...categories,
            },
            categoryCagr: {
              ...(portfolioCagr !== undefined ? { portfolio: portfolioCagr } : {}),
              ...(cagrs ?? {}),
            },
          }
        }),
      addAssetReturns: (assetReturns) =>
        set((state) => ({
          assetReturns: { ...state.assetReturns, ...assetReturns },
        })),
      setBenchmarks: (benchmarks, benchmarkCurrency) => set({ benchmarks, benchmarkCurrency }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'returns-store',
      partialize: (state) => ({
        categoryReturns: state.categoryReturns,
        categoryCagr: state.categoryCagr,
        assetReturns: state.assetReturns,
        benchmarks: state.benchmarks,
        benchmarkCurrency: state.benchmarkCurrency,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Object.keys(state.categoryReturns).length > 0) {
          state.loading = false
        }
      },
    },
  ),
)
