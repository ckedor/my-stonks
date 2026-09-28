import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  type MarketCatalogue,
  type MarketCatalogueKind,
  fetchFIIMarket,
  fetchReferenceEtfReadings,
  fetchMarketCatalogue,
  fetchMarketDataSeriesHistory,
  fetchMarketDataSeriesList,
  fetchUsdBrlHistory,
  fetchWorldMarketReadings,
} from '@/api/market'
import { EMPTY_LIST } from './empty'

/* As séries e as leituras mudam uma vez por dia, na importação da noite:
 * uma entrada vale por uma hora. */
const STALE_MS = 60 * 60 * 1000

const marketKeys = {
  all: ['market'] as const,
  series: () => [...marketKeys.all, 'series'] as const,
  seriesHistory: (seriesId: number) => [...marketKeys.all, 'series', seriesId, 'history'] as const,
  worldReadings: () => [...marketKeys.all, 'readings', 'world'] as const,
  etfReadings: () => [...marketKeys.all, 'readings', 'etfs'] as const,
  usdBrlHistory: () => [...marketKeys.all, 'usd-brl', 'history'] as const,
}

export function useMarketDataSeriesList() {
  const { data, isPending, isError } = useQuery({
    queryKey: marketKeys.series(),
    queryFn: fetchMarketDataSeriesList,
    staleTime: STALE_MS,
  })
  return { series: data ?? EMPTY_LIST, loading: isPending, failed: isError }
}

export function useMarketDataSeriesHistory(seriesId: number) {
  const { data, isPending, isError } = useQuery({
    queryKey: marketKeys.seriesHistory(seriesId),
    queryFn: () => fetchMarketDataSeriesHistory(seriesId),
    staleTime: STALE_MS,
    enabled: Number.isFinite(seriesId),
  })
  return { history: data ?? EMPTY_LIST, loading: isPending, failed: isError }
}

export function useUsdBrlHistory() {
  const { data, isPending, isError } = useQuery({
    queryKey: marketKeys.usdBrlHistory(),
    queryFn: () => fetchUsdBrlHistory(),
    staleTime: STALE_MS,
  })
  return { history: data ?? EMPTY_LIST, loading: isPending, failed: isError }
}

export function useWorldMarketReadings() {
  const { data, isPending, isError } = useQuery({
    queryKey: marketKeys.worldReadings(),
    queryFn: fetchWorldMarketReadings,
    staleTime: STALE_MS,
    // Meio megabyte de pontos semanais: fica em memória, fora do localStorage.
    meta: { persist: false },
  })
  return { readings: data, loading: isPending && !data, failed: isError }
}

/** Seis horas, o mesmo que o cache do servidor para os catálogos do mercado:
 *  revalidar antes disso é pedir de novo o que ele vai responder do cache. */
const CATALOGUE_STALE_MS = 6 * 60 * 60 * 1000

/* Os catálogos de fora da B3 são o cadastro inteiro — milhares de linhas,
   mais de um megabyte — e quase nenhuma tem preço: ficam em memória. */
const UNPERSISTED_CATALOGUES: ReadonlySet<MarketCatalogueKind> = new Set(['stock-us', 'etf-us'])

/** O catálogo de mercado de várias classes, cada uma na sua entrada de cache.
 *  Uma classe que falhe fica sem linhas; as outras seguem. `enabled` deixa a
 *  tela pedir as classes pesadas só quando alguém abre a aba delas. */
export function useMarketCatalogues(kinds: readonly MarketCatalogueKind[], enabled = true) {
  const results = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: [...marketKeys.all, 'catalogue', kind] as const,
      queryFn: () => fetchMarketCatalogue(kind),
      staleTime: CATALOGUE_STALE_MS,
      enabled,
      meta: UNPERSISTED_CATALOGUES.has(kind) ? { persist: false } : undefined,
    })),
  })
  /* A dependência é o dado, e não o array de resultados: o `useQueries`
     devolve um array novo a cada render, e memorizar sobre ele não memoriza
     nada. */
  const payloads = results.map((result) => result.data)
  const catalogues = useMemo(() => {
    const map = new Map<MarketCatalogueKind, MarketCatalogue>()
    payloads.forEach((payload, index) => {
      if (payload) map.set(kinds[index], payload)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, payloads)
  return {
    catalogues,
    loading: enabled && results.some((result) => result.isPending),
  }
}

/** Os FIIs da bolsa com segmento, P/VP e dividend yield. */
export function useFIIMarket(enabled = true) {
  const { data, isPending } = useQuery({
    queryKey: [...marketKeys.all, 'fii-market'] as const,
    queryFn: fetchFIIMarket,
    staleTime: CATALOGUE_STALE_MS,
    enabled,
  })
  return { funds: data?.funds ?? EMPTY_LIST, loading: enabled && isPending }
}

/** Os ETFs de referência, na ordem da lista curada. */
export function useReferenceEtfReadings() {
  const { data, isPending, isError } = useQuery({
    queryKey: marketKeys.etfReadings(),
    queryFn: fetchReferenceEtfReadings,
    staleTime: STALE_MS,
  })
  return { etfs: data ?? EMPTY_LIST, loading: isPending && !data, failed: isError }
}
