import {
  confirmFundSeriesAliases,
  fetchFundRegistryClass,
  fetchFundSeriesFiling,
  registerFund,
  selectFundSeries,
  searchFundRegistry,
  type RegisterFund,
  type SeriesAliasInput,
} from '@/api/fundRegistry'
import { EMPTY_LIST } from '@/queries/empty'
import { assetKeys } from '@/queries/assets'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/* O cadastro de fundos muda uma vez por semana; a leitura das séries vai à
   fonte e baixa arquivos, por isso só roda quando a tela pede e fica guardada
   enquanto a tela está aberta. */
const fundRegistryKeys = {
  all: ['fund-registry'] as const,
  search: (query: string) => [...fundRegistryKeys.all, 'search', query] as const,
  class: (classId: number) => [...fundRegistryKeys.all, 'class', classId] as const,
  series: (classId: number) => [...fundRegistryKeys.all, 'series', classId] as const,
}

const MIN_SEARCH_LENGTH = 3

export function useFundRegistrySearch(query: string) {
  const trimmed = query.trim()
  const { data, isFetching } = useQuery({
    queryKey: fundRegistryKeys.search(trimmed),
    queryFn: () => searchFundRegistry(trimmed),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    staleTime: 1000 * 60 * 10,
  })
  return { classes: data ?? EMPTY_LIST, searching: isFetching }
}

export function useFundRegistryClass(classId: number | null) {
  const { data, isPending } = useQuery({
    queryKey: fundRegistryKeys.class(classId ?? 0),
    queryFn: () => fetchFundRegistryClass(classId as number),
    enabled: classId !== null,
  })
  return { detail: data ?? null, loading: classId !== null && isPending }
}

export function useFundSeriesFiling(classId: number | null, enabled: boolean) {
  const { data, isFetching, error } = useQuery({
    queryKey: fundRegistryKeys.series(classId ?? 0),
    queryFn: () => fetchFundSeriesFiling(classId as number),
    enabled: enabled && classId !== null,
    staleTime: 1000 * 60 * 30,
    retry: false,
  })
  return { filing: data ?? null, reading: isFetching, failed: error !== null }
}

export function useRegisterFund() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterFund) => registerFund(payload),
    onSuccess: (_, payload) => Promise.all([
      queryClient.invalidateQueries({ queryKey: assetKeys.all }),
      queryClient.invalidateQueries({
        queryKey: fundRegistryKeys.class(payload.fund_registry_class_id),
      }),
    ]),
  })
}

export function useSelectFundSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, series_id, series_label }: {
      assetId: number; classId: number; series_id: number | null; series_label: string | null
    }) => selectFundSeries(assetId, { series_id, series_label }),
    onSuccess: (_, { classId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: fundRegistryKeys.class(classId) }),
      queryClient.invalidateQueries({ queryKey: assetKeys.all }),
    ]),
  })
}

export function useConfirmFundSeriesAliases(classId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, aliases }: { assetId: number; aliases: SeriesAliasInput[] }) =>
      confirmFundSeriesAliases(assetId, aliases),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: fundRegistryKeys.class(classId ?? 0) }),
  })
}
