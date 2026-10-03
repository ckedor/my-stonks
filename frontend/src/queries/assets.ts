import { fetchAsset, fetchAssets, fetchAssetTypes } from '@/api/assets'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { EMPTY_LIST } from './empty'

export const assetKeys = { all: ['assets'] as const }

export const assetQueryOptions = (assetId: number) => queryOptions({
  queryKey: [...assetKeys.all, 'detail', assetId],
  queryFn: () => fetchAsset(assetId),
})

export function useAssets() {
  const { data, isPending } = useQuery({
    queryKey: [...assetKeys.all, 'list'], queryFn: fetchAssets,
    /* O catálogo inteiro são ~4 MB: guardado, ele toma quase toda a cota do
       localStorage e empurra a carteira para fora da partida quente. */
    meta: { persist: false },
  })
  return { assets: data ?? EMPTY_LIST, loading: isPending }
}

export function useAssetTypes() {
  const { data, isPending } = useQuery({
    queryKey: [...assetKeys.all, 'types'], queryFn: fetchAssetTypes,
  })
  return { assetTypes: data ?? EMPTY_LIST, loading: isPending }
}
