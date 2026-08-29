import { fetchBenchmarks } from '@/api/market'
import {
  consolidatePortfolio,
  fetchAnalysis,
  fetchCategoryReturns,
  fetchDividends,
  fetchPatrimony,
  fetchPortfolios,
  fetchPositions,
  fetchReturns,
  fetchTrades,
} from '@/api/portfolio'
import { fetchConsolidation } from '@/api/consolidation'
import { fetchPortfolioWealthTier } from '@/api/wealth-tier'
import { useCurrencyStore, type Currency } from '@/stores/currency'
import { usePortfolioStore } from '@/stores/portfolio'
import type { CategoryReturnEntry, Portfolio, PortfolioReturnEntry, ReturnsEntry } from '@/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

/* As chaves em um lugar só.
 *
 * Moeda entra na chave em vez de disparar uma re-sincronização à mão: trocar o
 * seletor passa a ser uma leitura de outra chave, que ou já está em cache ou
 * é buscada. Era um `useEffect` no MainLayout que refazia seis buscas.
 *
 * A patente não leva moeda, ao contrário dos vizinhos: ela sai do patrimônio
 * em BRL, então o seletor não muda a resposta. */
const portfolioKeys = {
  all: ['portfolio'] as const,
  list: () => [...portfolioKeys.all, 'list'] as const,
  positions: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'positions', currency] as const,
  returns: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'returns', currency] as const,
  categoryReturns: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'category-returns', currency] as const,
  analysis: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'analysis', currency] as const,
  dividends: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'dividends', currency] as const,
  patrimony: (id: number, currency: Currency) =>
    [...portfolioKeys.all, id, 'patrimony', currency] as const,
  trades: (id: number) => [...portfolioKeys.all, id, 'trades'] as const,
  wealthTier: (id: number) => [...portfolioKeys.all, id, 'wealth-tier'] as const,
  consolidation: (id: number) => [...portfolioKeys.all, id, 'consolidation'] as const,
  benchmarks: (currency: Currency) => ['benchmarks', currency] as const,
}

/** A chave sob a qual a série da carteira inteira convive com as categorias. */
export const WHOLE_PORTFOLIO_CURVE = 'portfolio'

function selectPortfolioReturns(entries: PortfolioReturnEntry[]) {
  return {
    series: entries.map((entry) => ({ date: entry.date, value: entry.acc_return })),
    cagr: entries.length ? (entries[entries.length - 1].cagr ?? null) : null,
  }
}

function selectCategoryReturns(entries: CategoryReturnEntry[]) {
  const series: Record<string, ReturnsEntry[]> = {}
  const cagr: Record<string, number | null> = {}
  for (const entry of entries) {
    ;(series[entry.category] ??= []).push({ date: entry.date, value: entry.acc_return })
    cagr[entry.category] = entry.cagr ?? null
  }
  return { series, cagr }
}

function useCurrency(): Currency {
  return useCurrencyStore((s) => s.currency)
}

export function usePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.list(),
    queryFn: fetchPortfolios,
  })
}

/* A carteira aberta, resolvida contra a lista que veio do servidor.
 *
 * O id é o que fica guardado; o objeto é derivado dele a cada render. Guardar
 * o objeto deixava uma cópia da carteira envelhecendo no localStorage, que
 * continuava respondendo com o nome e as categorias antigas depois de uma
 * edição até a próxima sincronização. */
export function useSelectedPortfolio(): Portfolio | null {
  const { data: portfolios } = usePortfolios()
  const selectedId = usePortfolioStore((s) => s.selectedPortfolioId)
  return useMemo(() => {
    if (!portfolios?.length) return null
    return portfolios.find((portfolio) => portfolio.id === selectedId) ?? portfolios[0]
  }, [portfolios, selectedId])
}

export function useSelectedPortfolioId(): number | undefined {
  return useSelectedPortfolio()?.id
}

export function usePositions(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.positions(portfolioId!, currency),
    queryFn: () => fetchPositions(portfolioId!, currency),
    enabled: portfolioId != null,
  })
}

/** A série da carteira como as curvas a consomem: data e retorno acumulado. */
function usePortfolioReturns(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.returns(portfolioId!, currency),
    queryFn: () => fetchReturns(portfolioId!, currency),
    enabled: portfolioId != null,
    select: selectPortfolioReturns,
  })
}

/** As séries das categorias, agrupadas por nome, como as telas as leem. */
function useCategoryReturns(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.categoryReturns(portfolioId!, currency),
    queryFn: () => fetchCategoryReturns(portfolioId!, undefined, undefined, currency),
    enabled: portfolioId != null,
    select: selectCategoryReturns,
  })
}

/* As curvas que os gráficos oferecem: as categorias, mais a carteira inteira
 * sob a chave `portfolio`.
 *
 * As duas vêm de rotas diferentes e são montadas aqui, uma vez. Antes cada uma
 * escrevia no mesmo mapa de um store compartilhado, em momentos diferentes, e
 * a identidade do objeto guardado mudava a cada escrita — o que fazia o
 * recharts reanimar séries com dado idêntico. */
export interface ReturnCurves {
  series: Record<string, ReturnsEntry[]>
  cagr: Record<string, number | null>
  isPending: boolean
}

export function useReturnCurves(): ReturnCurves {
  const portfolio = usePortfolioReturns()
  const categories = useCategoryReturns()
  return useMemo<ReturnCurves>(
    () => ({
      series: {
        ...(categories.data?.series ?? {}),
        ...(portfolio.data ? { [WHOLE_PORTFOLIO_CURVE]: portfolio.data.series } : {}),
      },
      cagr: {
        ...(categories.data?.cagr ?? {}),
        ...(portfolio.data ? { [WHOLE_PORTFOLIO_CURVE]: portfolio.data.cagr } : {}),
      },
      isPending: portfolio.isPending || categories.isPending,
    }),
    [portfolio.data, categories.data, portfolio.isPending, categories.isPending],
  )
}

export function useBenchmarks() {
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.benchmarks(currency),
    queryFn: () => fetchBenchmarks(currency),
  })
}

export function useAnalysis(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.analysis(portfolioId!, currency),
    queryFn: () => fetchAnalysis(portfolioId!, currency),
    enabled: portfolioId != null,
  })
}

export function useDividends(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.dividends(portfolioId!, currency),
    queryFn: () => fetchDividends(portfolioId!, currency),
    enabled: portfolioId != null,
  })
}

export function usePatrimony(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const currency = useCurrency()
  return useQuery({
    queryKey: portfolioKeys.patrimony(portfolioId!, currency),
    queryFn: () => fetchPatrimony(portfolioId!, currency),
    enabled: portfolioId != null,
  })
}

export function useTrades(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  return useQuery({
    queryKey: portfolioKeys.trades(portfolioId!),
    queryFn: () => fetchTrades(portfolioId!),
    enabled: portfolioId != null,
  })
}

export function useWealthTier(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  return useQuery({
    queryKey: portfolioKeys.wealthTier(portfolioId!),
    queryFn: () => fetchPortfolioWealthTier(portfolioId!),
    enabled: portfolioId != null,
  })
}

/** Quando a carteira foi consolidada, e se a corrida deu certo. */
export function useConsolidation(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  return useQuery({
    queryKey: portfolioKeys.consolidation(portfolioId!),
    queryFn: () => fetchConsolidation(portfolioId!),
    enabled: portfolioId != null,
  })
}

/** Reler o que uma escrita nesta carteira pode ter mudado.
 *
 * Uma invalidação só, e não uma lista de re-sincronizações por chamador: editar
 * uma categoria mexe na lista de carteiras e nas séries, criar uma negociação
 * mexe nas posições e nas negociações, e quem escreve não deveria precisar
 * saber disso. Os benchmarks ficam de fora porque não dependem da carteira. */
export function useRefreshPortfolio() {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: portfolioKeys.all }),
    [queryClient],
  )
}

/* Consolidar e reler.
 *
 * A rota espera a consolidação das posições e só então despacha a das séries,
 * que roda em segundo plano — então invalidar aqui pode chegar antes das
 * séries novas. O carimbo é o que conta a verdade: a tela mostra `partial` ou
 * o horário antigo até a corrida terminar, em vez de fingir que terminou. */
export function useConsolidatePortfolio(explicitPortfolioId?: number) {
  const selectedPortfolioId = useSelectedPortfolioId()
  const portfolioId = explicitPortfolioId ?? selectedPortfolioId
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => consolidatePortfolio(portfolioId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...portfolioKeys.all, portfolioId] }),
  })
}
