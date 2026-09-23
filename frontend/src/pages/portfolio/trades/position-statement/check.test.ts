import type { Trade } from '@/types'
import { describe, expect, it } from 'vitest'
import { isWithoutNote, tradesOf, updateHolding } from './check'

const trade = (id: number, overrides: Partial<Trade>): Trade =>
  ({
    id,
    asset_id: 59,
    broker_id: 2,
    date: '2026-09-01T00:00:00' as unknown as Date,
    quantity: 1,
    brokerage_note_id: null,
    ...overrides,
  }) as Trade

describe('position check', () => {
  it('lists the asset trades at the broker up to the statement day, newest first', () => {
    const trades = [
      trade(1, { date: '2026-01-10T00:00:00' as unknown as Date }),
      trade(2, { date: '2026-09-30T00:00:00' as unknown as Date }),
      trade(3, { date: '2026-10-01T00:00:00' as unknown as Date }),
      trade(4, { broker_id: 3 }),
      trade(5, { asset_id: 60 }),
    ]

    expect(tradesOf(trades, 59, 2, '2026-09-30').map((t) => t.id)).toEqual([2, 1])
  })

  it('points at trades entered by hand as the candidates', () => {
    expect(isWithoutNote(trade(1, { brokerage_note_id: null }))).toBe(true)
    expect(isWithoutNote(trade(2, { brokerage_note_id: 7 }))).toBe(false)
  })

  it('corrects one statement line at a time', () => {
    const holdings = [
      { index: 0, security: 'A', ticker: 'A', quantity: 1, asset_id: null },
      { index: 1, security: 'B', ticker: 'B', quantity: 2, asset_id: 9 },
    ]

    expect(updateHolding(holdings, 0, { asset_id: 5 }).map((h) => h.asset_id)).toEqual([5, 9])
  })
})
