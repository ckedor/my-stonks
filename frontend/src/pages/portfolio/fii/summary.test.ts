import type { FIIPortfolioPositionEntry } from '@/types'
import { describe, expect, it } from 'vitest'
import { groupFIIConcentration, isFIIPosition } from './summary'

const position = (
  ticker: string,
  value: number,
  fiiType: string | null,
  fiiSegment: string | null,
): FIIPortfolioPositionEntry => ({
  asset_id: value,
  date: '2026-03-17',
  ticker,
  name: ticker,
  quantity: 1,
  average_price: value,
  profit_pct: 0,
  category: 'FIIs',
  value,
  price: value,
  acc_return: 0,
  twelve_months_return: 0,
  cagr: 0,
  total_invested: value,
  type: 'FII',
  type_id: 2,
  class: 'Renda Variável',
  fii_type: fiiType,
  fii_segment: fiiSegment,
})

describe('FII portfolio summary', () => {
  const positions = [
    position('HGLG11', 60, 'Tijolo', 'Logística'),
    position('XPML11', 30, 'Tijolo', 'Shopping'),
    position('KNCR11', 10, 'Papel', null),
  ]

  it('recognises positions by the persisted asset type', () => {
    expect(positions.every(isFIIPosition)).toBe(true)
    expect(isFIIPosition({ ...positions[0], type: 'Outro', type_id: 4 })).toBe(false)
  })

  it('groups current market value by FII type', () => {
    expect(groupFIIConcentration(positions, 'type')).toEqual([
      { label: 'Tijolo', value: 90, assetCount: 2 },
      { label: 'Papel', value: 10, assetCount: 1 },
    ])
  })

  it('keeps assets without metadata visible', () => {
    expect(groupFIIConcentration(positions, 'segment')).toContainEqual({
      label: 'Não classificado',
      value: 10,
      assetCount: 1,
    })
  })
})
