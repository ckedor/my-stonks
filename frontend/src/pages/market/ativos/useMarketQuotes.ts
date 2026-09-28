import type { MarketCatalogueAsset, MarketCatalogueKind } from '@/api/market'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { useMarketCatalogues } from '@/queries/market'
import { useCallback, useMemo } from 'react'

/* O preço de mercado dos ativos que a listagem do cadastro mostra.
 *
 * A lista de ativos é o cadastro do app — é ele que diz o que existe, e é dele
 * que saem tipo, classe e id. O que o cadastro não tem é o mercado: preço,
 * variação do dia e volume. Isso vem do catálogo de mercado, que o backend já
 * guarda em cache por seis horas e devolve inteiro por classe.
 *
 * Casar os dois por ticker, e não por id, é o que faz a tela funcionar antes de
 * qualquer sincronização: um ativo recém-listado na B3 aparece no catálogo com
 * `asset_id` nulo, e um papel só do cadastro — renda fixa, tesouro — não
 * aparece em catálogo nenhum e simplesmente fica sem cotação.
 *
 * O ticker só é único dentro de uma praça. Cripto é outra: o ETF de bitcoin da
 * Grayscale também se chama BTC, e num mapa só ele herdava o preço do bitcoin.
 * Por isso a cripto tem o seu mapa, e só um criptoativo o consulta. */

/** As classes de bolsa que a listagem cobre, B3 e fora dela. */
const EXCHANGE_KINDS: MarketCatalogueKind[] = ['stock', 'etf', 'fii', 'bdr', 'stock-us', 'etf-us']
const KINDS: MarketCatalogueKind[] = [...EXCHANGE_KINDS, 'crypto']

export interface MarketQuote {
  price: number | null
  changePercent: number | null
  volume: number | null
  logoUrl: string | null
}

export interface MarketQuotes {
  quoteOf: (asset: { ticker: string | null; asset_type_id: number }) => MarketQuote | undefined
  loading: boolean
}

export interface QuoteIndex {
  exchange: Map<string, MarketQuote>
  crypto: Map<string, MarketQuote>
}

/** Os catálogos indexados por ticker, uma praça por mapa. */
export function indexQuotes(
  catalogues: Map<MarketCatalogueKind, { assets: MarketCatalogueAsset[] }>
): QuoteIndex {
  const exchange = new Map<string, MarketQuote>()
  const crypto = new Map<string, MarketQuote>()
  for (const [kind, catalogue] of catalogues) {
    const target = kind === 'crypto' ? crypto : exchange
    for (const asset of catalogue.assets) {
      const key = asset.ticker.toUpperCase()
      // O mesmo ticker em dois catálogos, um deles sem preço: fica o que tem.
      if (asset.price == null && target.has(key)) continue
      target.set(key, {
        price: asset.price,
        changePercent: asset.change_percent,
        volume: asset.volume,
        logoUrl: asset.logo_url,
      })
    }
  }
  return { exchange, crypto }
}

/** A cotação de um ativo do cadastro: um criptoativo só no mapa da cripto,
 *  todo o resto só no da bolsa. */
export function lookupQuote(
  index: QuoteIndex,
  asset: { ticker: string | null; asset_type_id: number }
): MarketQuote | undefined {
  if (!asset.ticker) return undefined
  const map = asset.asset_type_id === ASSET_TYPES.CRIPTO ? index.crypto : index.exchange
  return map.get(asset.ticker.toUpperCase())
}

export function useMarketQuotes(): MarketQuotes {
  const { catalogues, loading } = useMarketCatalogues(KINDS)
  const index = useMemo(() => indexQuotes(catalogues), [catalogues])
  const quoteOf = useCallback(
    (asset: { ticker: string | null; asset_type_id: number }) => lookupQuote(index, asset),
    [index]
  )
  return { quoteOf, loading }
}
