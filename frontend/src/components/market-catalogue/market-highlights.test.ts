import { describe, expect, it } from 'vitest'
import type { MarketCatalogue, MarketCatalogueAsset, MarketCatalogueKind } from '@/api/market'
import {
  cleanCatalogues,
  largestBy,
  onePerCompany,
  financialVolume,
  mostTraded,
  sectorGroups,
  sectorLabel,
} from './market-highlights'

const asset = (
  ticker: string,
  {
    price = 10,
    volume = 1000,
    change = 0,
    cap = null as number | null,
    sector = null as string | null,
  } = {}
): MarketCatalogueAsset => ({
  asset_id: null,
  ticker,
  name: ticker,
  price,
  change_percent: change,
  volume,
  market_cap: cap,
  currency: 'BRL',
  logo_url: null,
  sector,
  subsector: null,
})

describe('market highlights', () => {
  it('weighs exchange volume by price, and takes crypto volume as money', () => {
    expect(financialVolume(asset('PETR4', { price: 40, volume: 1000 }))).toBe(40_000)
    expect(financialVolume(asset('BTC', { price: 400_000, volume: 1000 }), true)).toBe(1000)
  })

  it('ranks by money traded, not by shares', () => {
    const assets = [
      asset('PENNY', { price: 0.3, volume: 1_000_000 }),
      asset('VALE3', { price: 60, volume: 100_000 }),
    ]
    expect(mostTraded(assets).map((a) => a.ticker)).toEqual(['VALE3', 'PENNY'])
  })

  it('keeps one share class per company, the most traded', () => {
    const assets = [
      asset('PETR3', { volume: 10 }),
      asset('PETR4', { volume: 900 }),
      asset('VALE3', { volume: 50 }),
    ]

    expect(onePerCompany(assets).map((a) => a.ticker)).toEqual(['PETR4', 'VALE3'])
  })

  it('ranks the largest by a measure, leaving out who has none', () => {
    const assets = [
      asset('SMALL', { cap: 10 }),
      asset('NONE'),
      asset('LARGE', { cap: 300 }),
      asset('MID', { cap: 90 }),
    ]

    expect(largestBy(assets, (a) => a.market_cap, 2).map((a) => a.ticker)).toEqual(['LARGE', 'MID'])
  })

  it('groups the largest companies by sector, largest sector first', () => {
    const groups = sectorGroups(
      [
        asset('ITUB4', { cap: 300, sector: 'Finance' }),
        asset('PETR4', { cap: 500, sector: 'Energy Minerals' }),
        asset('BBAS3', { cap: 250, sector: 'Finance' }),
        asset('TINY3', { cap: 1, sector: 'Finance' }),
        // A mesma Petrobras, menos negociada: não entra uma segunda vez.
        asset('PETR3', { cap: 500, sector: 'Energy Minerals', volume: 1 }),
      ],
      3
    )

    expect(groups.map((g) => [g.sector, g.assets.length])).toEqual([
      ['Financeiro', 2],
      ['Petróleo e gás', 1],
    ])
    expect(sectorLabel('Something New')).toBe('Something New')
  })

  it('drops fractional lots, and keeps in the fund catalogue only FIIs', () => {
    const catalogue = (...tickers: string[]): MarketCatalogue => ({
      assets: tickers.map((ticker) => asset(ticker)),
      total: tickers.length,
      source: 'test',
    })
    const clean = cleanCatalogues(
      new Map<MarketCatalogueKind, MarketCatalogue>([
        ['stock', catalogue('PETR4', 'PETR4F', 'KLBN11', 'KLBN11F')],
        ['etf', catalogue('BOVA11')],
        // O provedor lista como fundo o ETF, o índice e o FIAGRO.
        ['fii', catalogue('BOVA11', 'IBOV11', 'KNCA11', 'HGLG11')],
      ]),
      new Set(['HGLG11'])
    )

    expect(clean.get('stock')!.map((a) => a.ticker)).toEqual(['PETR4', 'KLBN11'])
    expect(clean.get('fii')!.map((a) => a.ticker)).toEqual(['HGLG11'])
    expect(clean.get('etf')!.map((a) => a.ticker)).toEqual(['BOVA11'])
  })

  it('folds sectors too small to label into one', () => {
    const groups = sectorGroups(
      [
        asset('PETR4', { cap: 900, sector: 'Energy Minerals' }),
        asset('TOTS3', { cap: 20, sector: 'Technology Services' }),
        asset('RADL3', { cap: 30, sector: 'Retail Trade' }),
        asset('ITUB4', { cap: 50, sector: 'Finance' }),
      ],
      10,
      0.04
    )

    expect(groups.map((g) => [g.sector, g.marketCap])).toEqual([
      ['Petróleo e gás', 900],
      ['Financeiro', 50],
      ['Outros setores', 50],
    ])
  })
})
