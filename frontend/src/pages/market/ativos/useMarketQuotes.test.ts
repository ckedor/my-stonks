import { describe, expect, it } from 'vitest'
import type { MarketCatalogueAsset, MarketCatalogueKind } from '@/api/market'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { indexQuotes, lookupQuote } from './useMarketQuotes'

const row = (ticker: string, price: number | null): MarketCatalogueAsset => ({
  asset_id: null,
  ticker,
  name: ticker,
  price,
  change_percent: null,
  volume: null,
  market_cap: null,
  currency: 'BRL',
  logo_url: null,
  sector: null,
  subsector: null,
})

describe('market quotes for the registry', () => {
  it('keeps crypto apart from the exchange, where tickers repeat', () => {
    // O ETF de bitcoin da Grayscale se chama BTC, como o bitcoin.
    const index = indexQuotes(
      new Map<MarketCatalogueKind, { assets: MarketCatalogueAsset[] }>([
        ['crypto', { assets: [row('BTC', 432_000)] }],
        ['etf-us', { assets: [row('BTC', null)] }],
      ])
    )

    expect(lookupQuote(index, { ticker: 'btc', asset_type_id: ASSET_TYPES.CRIPTO })?.price).toBe(
      432_000
    )
    expect(lookupQuote(index, { ticker: 'BTC', asset_type_id: ASSET_TYPES.ETF })?.price).toBeNull()
  })

  it('does not let an unpriced row hide a priced one with the same ticker', () => {
    const index = indexQuotes(
      new Map<MarketCatalogueKind, { assets: MarketCatalogueAsset[] }>([
        ['fii', { assets: [row('KDIF11', 114.5)] }],
        ['stock-us', { assets: [row('KDIF11', null)] }],
      ])
    )

    expect(lookupQuote(index, { ticker: 'KDIF11', asset_type_id: ASSET_TYPES.FI })?.price).toBe(
      114.5
    )
  })
})
