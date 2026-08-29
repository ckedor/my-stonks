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

/* Hidratar com o mesmo conteúdo não é uma mudança de estado.
 *
 * A mesma série chega aqui mais de uma vez na abertura da tela: o `persist`
 * devolve o que ficou no localStorage e, logo depois, o SWR entrega o cache
 * do IndexedDB e a resposta da rede. Sem esta comparação, cada entrega troca
 * a identidade do objeto guardado — e o recharts decide reanimar uma série
 * por identidade de props, então as curvas eram redesenhadas com dado
 * idêntico, uma por cima da outra.
 *
 * A comparação é por conteúdo e rasa de propósito: `ReturnsEntry` é um par
 * de primitivos, e a série mais longa da carteira tem alguns milhares de
 * pontos — percorrer é mais barato do que repintar. */
function sameSeries(a: ReturnsEntry[] | undefined, b: ReturnsEntry[]): boolean {
  if (a === b) return true
  if (!a || a.length !== b.length) return false
  return a.every((entry, i) => entry.date === b[i].date && entry.value === b[i].value)
}

function sameSeriesMap(
  a: Record<string, ReturnsEntry[]>,
  b: Record<string, ReturnsEntry[]>,
): boolean {
  if (a === b) return true
  const keys = Object.keys(b)
  if (Object.keys(a).length !== keys.length) return false
  return keys.every((key) => sameSeries(a[key], b[key]))
}

function sameCagrMap(
  a: Record<string, number | null>,
  b: Record<string, number | null>,
): boolean {
  const keys = Object.keys(b)
  if (Object.keys(a).length !== keys.length) return false
  return keys.every((key) => a[key] === b[key])
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
        set((state) => {
          const nextCagr = cagr ?? null
          if (sameSeries(state.categoryReturns.portfolio, returns) && state.categoryCagr.portfolio === nextCagr) {
            /* `loading` cai mesmo quando o dado repete: quem esperava a
               resposta precisa saber que ela chegou. Devolver o próprio
               `state` é o que faz o zustand não avisar ninguém. */
            return state.loading ? { loading: false } : state
          }
          return {
            categoryReturns: { ...state.categoryReturns, portfolio: returns },
            categoryCagr: { ...state.categoryCagr, portfolio: nextCagr },
            loading: false,
          }
        }),
      setCategoryReturns: (name, returns) =>
        set((state) =>
          sameSeries(state.categoryReturns[name], returns)
            ? state
            : { categoryReturns: { ...state.categoryReturns, [name]: returns } },
        ),
      setAllCategoryReturns: (categories, cagrs) =>
        set((state) => {
          const portfolioReturns = state.categoryReturns.portfolio
          const portfolioCagr = state.categoryCagr.portfolio

          const nextReturns = {
            ...(portfolioReturns ? { portfolio: portfolioReturns } : {}),
            ...categories,
          }
          const nextCagr = {
            ...(portfolioCagr !== undefined ? { portfolio: portfolioCagr } : {}),
            ...(cagrs ?? {}),
          }

          if (sameSeriesMap(state.categoryReturns, nextReturns) && sameCagrMap(state.categoryCagr, nextCagr)) {
            return state
          }

          return { categoryReturns: nextReturns, categoryCagr: nextCagr }
        }),
      addAssetReturns: (assetReturns) =>
        set((state) => {
          const next = { ...state.assetReturns, ...assetReturns }
          return sameSeriesMap(state.assetReturns, next) ? state : { assetReturns: next }
        }),
      setBenchmarks: (benchmarks, benchmarkCurrency) =>
        set((state) =>
          state.benchmarkCurrency === benchmarkCurrency && sameSeriesMap(state.benchmarks, benchmarks)
            ? state
            : { benchmarks, benchmarkCurrency },
        ),
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
