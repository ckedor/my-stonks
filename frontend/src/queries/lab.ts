import {
  compareBacktests,
  createTheoreticalPortfolio,
  deleteTheoreticalPortfolio,
  fetchPresets,
  fetchTheoreticalPortfolios,
  runBacktest,
  updateTheoreticalPortfolio,
  type RunBacktest,
  type SaveTheoreticalPortfolio,
} from '@/api/lab'
import { fetchAssetCatalogue, fetchMarketDataSeriesOptions } from '@/api/market'
import { fetchRecommendedPortfolios } from '@/api/research'
import { EMPTY_LIST } from '@/queries/empty'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/* As chaves do laboratório.
 *
 * Não levam moeda nem id de carteira: uma carteira teórica é do usuário e não
 * de uma carteira real, e a moeda é parâmetro da simulação, que é mutation e
 * não leitura em cache. */
const labKeys = {
  all: ['lab'] as const,
  portfolios: () => [...labKeys.all, 'portfolios'] as const,
  presets: () => [...labKeys.all, 'presets'] as const,
  assets: () => [...labKeys.all, 'assets'] as const,
  series: () => [...labKeys.all, 'series'] as const,
  recommended: () => [...labKeys.all, 'recommended'] as const,
}

export function useTheoreticalPortfolios() {
  const { data, isPending } = useQuery({
    queryKey: labKeys.portfolios(),
    queryFn: fetchTheoreticalPortfolios,
  })
  return { portfolios: data ?? EMPTY_LIST, loading: isPending && !data }
}

/* O catálogo, as séries e as carteiras recomendadas são leituras de outros
   módulos que a bancada consome. Ficam aqui, e não em `useQuery` dentro da
   página, porque leitura de servidor mora em `src/queries/` — e porque um
   `?? []` na página devolveria um array novo a cada render, derrubando a
   memoização de tudo que depende dele. */
export function useLabAssets() {
  const { data } = useQuery({
    queryKey: labKeys.assets(),
    queryFn: fetchAssetCatalogue,
    staleTime: 1000 * 60 * 60,
  })
  return data ?? EMPTY_LIST
}

export function useLabSeries() {
  const { data } = useQuery({
    queryKey: labKeys.series(),
    queryFn: fetchMarketDataSeriesOptions,
    staleTime: Infinity,
  })
  return data ?? EMPTY_LIST
}

export function useLabRecommendedPortfolios() {
  const { data } = useQuery({
    queryKey: labKeys.recommended(),
    queryFn: fetchRecommendedPortfolios,
    staleTime: 1000 * 60 * 60,
  })
  return data ?? EMPTY_LIST
}

export function usePresets() {
  /* Os modelos são código do backend: não mudam entre um deploy e outro, então
     não há por que revalidá-los durante a sessão. */
  const { data } = useQuery({
    queryKey: labKeys.presets(),
    queryFn: fetchPresets,
    staleTime: Infinity,
  })
  return data ?? EMPTY_LIST
}

/** Invalida a lista depois de uma escrita. Nada é copiado para store. */
function useRefreshLab() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: labKeys.all })
  }, [queryClient])
}

export function useSaveTheoreticalPortfolio() {
  const refresh = useRefreshLab()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: SaveTheoreticalPortfolio }) =>
      id === null ? createTheoreticalPortfolio(data) : updateTheoreticalPortfolio(id, data),
    onSuccess: refresh,
  })
}

export function useDeleteTheoreticalPortfolio() {
  const refresh = useRefreshLab()
  return useMutation({ mutationFn: deleteTheoreticalPortfolio, onSuccess: refresh })
}

/* A simulação é mutation e não query: é cara, é sob demanda e sai de um botão.
   Como query ela rodaria de novo sozinha a cada foco de janela, e o resultado
   não é dado de servidor que envelhece — é a resposta a um pedido. */
export function useRunBacktest() {
  return useMutation({ mutationFn: (data: RunBacktest) => runBacktest(data) })
}

export function useCompareBacktests() {
  return useMutation({ mutationFn: (runs: RunBacktest[]) => compareBacktests(runs) })
}
