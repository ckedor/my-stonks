import { describe, expect, it } from 'vitest'
import { categoryPositions, summarizeCategory } from './summary'
import type { PortfolioPositionEntry, ReturnsEntry } from '@/types'

function position(overrides: Partial<PortfolioPositionEntry>): PortfolioPositionEntry {
  return {
    asset_id: 1,
    date: '2026-03-17',
    ticker: 'PETR4',
    name: 'Petrobras PN',
    quantity: 100,
    average_price: 30,
    profit_pct: 0,
    category: 'Ações',
    value: 1000,
    price: 30,
    acc_return: 0,
    twelve_months_return: 0,
    cagr: 0,
    total_invested: 1000,
    type: 'Ação',
    class: 'Renda Variável',
    ...overrides,
  }
}

const CARTEIRA = [
  position({ asset_id: 1, ticker: 'PETR4', category: 'Ações', value: 3000 }),
  position({ asset_id: 2, ticker: 'BOVA11', category: 'Ações', value: 1000 }),
  position({ asset_id: 3, ticker: 'HGLG11', category: 'FIIs', value: 6000 }),
]

describe('categoryPositions', () => {
  it('recorta a categoria e ordena da maior posição para a menor', () => {
    expect(categoryPositions(CARTEIRA, 'Ações').map((p) => p.ticker)).toEqual(['PETR4', 'BOVA11'])
  })

  it('devolve vazio para categoria sem posição', () => {
    expect(categoryPositions(CARTEIRA, 'Cripto')).toEqual([])
  })
})

describe('summarizeCategory', () => {
  const returns: ReturnsEntry[] = [
    { date: '2026-01-01', value: 0.1 },
    { date: '2026-03-17', value: 0.42 },
  ]

  it('soma a categoria e pesa contra a carteira inteira', () => {
    const summary = summarizeCategory(CARTEIRA, returns, 'Ações')

    expect(summary.value).toBe(4000)
    expect(summary.weight).toBe(40)
    expect(summary.assetCount).toBe(2)
  })

  it('usa o último ponto da série como rentabilidade acumulada', () => {
    expect(summarizeCategory(CARTEIRA, returns, 'Ações').accReturn).toBe(0.42)
  })

  it('não inventa peso nem rentabilidade quando não há o que dividir', () => {
    const summary = summarizeCategory([], [], 'Ações')

    expect(summary.weight).toBeNull()
    expect(summary.accReturn).toBeNull()
  })
})
