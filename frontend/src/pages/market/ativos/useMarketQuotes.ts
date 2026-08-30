import { fetchMarketCatalogue, type MarketCatalogueKind } from '@/api/market'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

/* O preço de mercado dos ativos que a listagem mostra.
 *
 * A lista de ativos é o cadastro do app — é ele que diz o que existe, e é dele
 * que saem tipo, classe e id. O que o cadastro não tem é o mercado: preço,
 * variação do dia e volume. Isso vem do catálogo do provedor, que o backend já
 * guarda em cache por seis horas e devolve inteiro por classe.
 *
 * Casar os dois por ticker, e não por id, é o que faz a tela funcionar antes de
 * qualquer sincronização: um ativo recém-listado na B3 aparece no catálogo com
 * `asset_id` nulo, e um papel só do cadastro — renda fixa, tesouro — não
 * aparece em catálogo nenhum e simplesmente fica sem cotação.
 *
 * As classes são buscadas em paralelo porque são endpoints diferentes do mesmo
 * assunto; uma que falhe deixa a sua fatia sem preço em vez de derrubar a
 * listagem. */

/** Seis horas, o mesmo que o cache do servidor: revalidar antes disso é pedir
 *  de novo o que ele vai responder do cache. */
const CATALOGUE_STALE_TIME = 6 * 60 * 60 * 1000

/** As classes que a listagem cobre. Cripto entra: o app tem posições nela. */
const KINDS: MarketCatalogueKind[] = ['stock', 'etf', 'fii', 'bdr', 'crypto']

export interface MarketQuote {
  price: number | null
  changePercent: number | null
  volume: number | null
  logoUrl: string | null
}

export interface MarketQuotes {
  /** Cotação por ticker em caixa alta. */
  byTicker: Map<string, MarketQuote>
  loading: boolean
}

export function useMarketQuotes(): MarketQuotes {
  const results = useQueries({
    queries: KINDS.map((kind) => ({
      queryKey: ['market-catalogue', kind] as const,
      queryFn: () => fetchMarketCatalogue(kind),
      staleTime: CATALOGUE_STALE_TIME,
    })),
  })

  const loading = results.some((result) => result.isPending)
  /* A dependência é o dado, e não o array de resultados: o `useQueries`
     devolve um array novo a cada render, e memorizar sobre ele não memoriza
     nada. */
  const payloads = results.map((result) => result.data)

  const byTicker = useMemo(() => {
    const map = new Map<string, MarketQuote>()
    for (const payload of payloads) {
      for (const asset of payload?.assets ?? []) {
        map.set(asset.ticker.toUpperCase(), {
          price: asset.price,
          changePercent: asset.change_percent,
          volume: asset.volume,
          logoUrl: asset.logo_url,
        })
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, payloads)

  return { byTicker, loading }
}
