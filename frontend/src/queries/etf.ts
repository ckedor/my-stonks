import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchEtfHoldings, fetchEtfProfile } from '@/api/etf'

/* As chaves do ETF. O cadastro e a carteira mudam uma vez por semana no
 * máximo, então uma entrada vale por uma hora. */
const etfKeys = {
  all: ['etf'] as const,
  profile: (assetId: number) => [...etfKeys.all, 'profile', assetId] as const,
  holdings: (assetId: number, page: number, pageSize: number) =>
    [...etfKeys.all, 'holdings', assetId, page, pageSize] as const,
}

const STALE_MS = 60 * 60 * 1000

export function useEtfProfile(assetId: number) {
  const { data, isPending, isError } = useQuery({
    queryKey: etfKeys.profile(assetId),
    queryFn: () => fetchEtfProfile(assetId),
    staleTime: STALE_MS,
  })
  return { profile: data, loading: isPending && !data, failed: isError }
}

/** Uma página da carteira. A anterior fica na tela enquanto a próxima chega,
 *  para a tabela não piscar vazia a cada troca de página. */
export function useEtfHoldings(assetId: number, page: number, pageSize: number, enabled: boolean) {
  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: etfKeys.holdings(assetId, page, pageSize),
    queryFn: () => fetchEtfHoldings(assetId, page, pageSize),
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
    enabled,
  })
  return { holdings: data, loading: isPending && !data && enabled, paging: isFetching, failed: isError }
}
