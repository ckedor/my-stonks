import type { PortfolioPositionEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import {
  CONCENTRATION_DIMENSIONS,
  groupConcentration,
  positionsInGroup,
} from './concentration'

function position(overrides: Partial<PortfolioPositionEntry>): PortfolioPositionEntry {
  return {
    asset_id: 1,
    date: '2026-03-17',
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    quantity: 10,
    average_price: 100,
    profit_pct: 0,
    category: 'FIIs',
    value: 1000,
    price: 100,
    acc_return: 0,
    twelve_months_return: 0,
    cagr: 0,
    total_invested: 1000,
    type: 'FII',
    type_id: 2,
    class: 'Renda Variável',
    ...overrides,
  }
}

const FIIS = [
  position({ asset_id: 1, ticker: 'HGLG11', value: 60, fii_type: 'Tijolo', fii_segment: 'Logística' }),
  position({ asset_id: 2, ticker: 'XPML11', value: 30, fii_type: 'Tijolo', fii_segment: 'Shopping' }),
  position({ asset_id: 3, ticker: 'KNCR11', value: 10, fii_type: 'Papel', fii_segment: null }),
]

describe('groupConcentration', () => {
  it('soma o valor de mercado do grupo e conta os ativos dele', () => {
    expect(groupConcentration(FIIS, CONCENTRATION_DIMENSIONS.fiiType)).toEqual([
      { label: 'Tijolo', value: 90, assetCount: 2 },
      { label: 'Papel', value: 10, assetCount: 1 },
    ])
  })

  /* Uma fatia escondida faz o total mentir: sem grupo, a posição vira um
     grupo com nome, e não some da pizza. */
  it('mantém visível o ativo sem a informação da dimensão', () => {
    expect(groupConcentration(FIIS, CONCENTRATION_DIMENSIONS.fiiSegment)).toContainEqual({
      label: 'Não classificado',
      value: 10,
      assetCount: 1,
    })
  })

  it('ordena do maior para o menor, que é como a pizza é lida', () => {
    const labels = groupConcentration(FIIS, CONCENTRATION_DIMENSIONS.asset).map((e) => e.label)

    expect(labels).toEqual(['HGLG11', 'XPML11', 'KNCR11'])
  })

  /* A dimensão que toda tela de recorte tem: um ativo, uma fatia. */
  it('por ativo, cada posição é o próprio grupo', () => {
    const byAsset = groupConcentration(FIIS, CONCENTRATION_DIMENSIONS.asset)

    expect(byAsset).toHaveLength(FIIS.length)
    expect(byAsset.every((entry) => entry.assetCount === 1)).toBe(true)
  })

  it('lê a renda fixa sem indexador como prefixada', () => {
    const fixedIncome = [
      position({ asset_id: 4, ticker: 'CDB', type: 'CDB', value: 50, index: 'CDI' }),
      position({ asset_id: 5, ticker: 'LTN', type: 'Tesouro', value: 20, index: null }),
    ]

    expect(groupConcentration(fixedIncome, CONCENTRATION_DIMENSIONS.fixedIncomeIndex)).toEqual([
      { label: 'CDI', value: 50, assetCount: 1 },
      { label: 'Prefixado', value: 20, assetCount: 1 },
    ])
  })

  it('não inventa grupo sem posição', () => {
    expect(groupConcentration([], CONCENTRATION_DIMENSIONS.asset)).toEqual([])
  })
})

describe('positionsInGroup', () => {
  it('recorta pelo mesmo rótulo que a pizza desenhou', () => {
    const tijolo = positionsInGroup(FIIS, CONCENTRATION_DIMENSIONS.fiiType, 'Tijolo')

    expect(tijolo.map((entry) => entry.ticker)).toEqual(['HGLG11', 'XPML11'])
  })

  it('alcança o grupo sem nome pelo rótulo que ele recebeu', () => {
    const unclassified = positionsInGroup(
      FIIS,
      CONCENTRATION_DIMENSIONS.fiiSegment,
      'Não classificado',
    )

    expect(unclassified.map((entry) => entry.ticker)).toEqual(['KNCR11'])
  })
})
