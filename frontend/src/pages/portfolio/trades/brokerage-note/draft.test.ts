import type { DraftNote, ReconciliationGroup } from '@/api/brokerageNote'
import { describe, expect, it } from 'vitest'
import {
  countByAction,
  decisionsFor,
  defaultActions,
  initialHeader,
  initialRows,
  isRowInvalid,
  toLineInputs,
  updateRow,
} from './draft'

const note: DraftNote = {
  index: 2,
  broker_name: 'AVENUE SECURITIES LLC',
  broker_cnpj: null,
  broker_id: 2,
  currency: 'USD',
  note_number: null,
  trade_date: '2026-09-21',
  settlement_date: '2026-09-22',
  amounts: {
    purchases_total: 0,
    sales_total: 8966.58,
    operations_total: null,
    settlement_fee: null,
    registration_fee: null,
    emoluments: null,
    other_exchange_fees: null,
    brokerage: null,
    iss: null,
    other_costs: null,
    withheld_income_tax: null,
    net_amount: null,
  },
  fees: 0,
  warnings: [],
  groups: [],
  imported_note_id: null,
  imported_at: null,
  lines: [
    {
      index: 0,
      side: 'V',
      market: null,
      security: 'INVESCO NASDAQ 100 ETF',
      ticker: 'QQQM',
      quantity: 24.45205,
      price: 299.9923,
      value: 7335.43,
      fees: 0,
      withheld_income_tax: null,
      asset_id: 59,
      asset_name: 'QQQM',
      match: 'matched',
    },
    {
      index: 1,
      side: 'V',
      market: null,
      security: 'SCHWAB US DIVIDEND EQUITY ETF',
      ticker: 'SCHD',
      quantity: 48.38442,
      price: 33.7123,
      value: 1631.15,
      fees: 0,
      withheld_income_tax: null,
      asset_id: null,
      asset_name: null,
      match: 'unknown',
    },
  ],
}

const group = (key: string, overrides: Partial<ReconciliationGroup> = {}): ReconciliationGroup => ({
  key,
  status: 'new',
  default_action: 'create',
  actions: ['create', 'skip'],
  broker_id: 2,
  asset_id: 59,
  trade_date: '2026-09-21',
  side: 'V',
  lines: [{ note_index: 2, line_index: 0 }],
  existing_ids: [],
  message: null,
  warnings: [],
  ...overrides,
})

describe('brokerage note draft', () => {
  it('builds each line from the row and the note header', () => {
    const header = { ...initialHeader(note, 55), broker_id: 9, trade_date: '2026-09-20' }

    const lines = toLineInputs(note.index, header, initialRows(note))

    expect(lines[1]).toEqual({
      note_index: 2,
      line_index: 1,
      broker_id: 9,
      asset_id: null,
      trade_date: '2026-09-20',
      settlement_date: '2026-09-22',
      currency: 'USD',
      side: 'V',
      quantity: 48.38442,
      price: 33.7123,
      fees: 0,
      withheld_income_tax: null,
    })
  })

  it('edits only the chosen row, and refuses a row without quantity', () => {
    const rows = updateRow(initialRows(note), 1, { asset_id: 10116, quantity: 0 })

    expect(rows.map((row) => row.asset_id)).toEqual([59, 10116])
    expect(rows.map(isRowInvalid)).toEqual([false, true])
  })

  it('decides with the default action unless the person changed it', () => {
    const groups = [
      group('a'),
      group('b', { status: 'conflict', default_action: 'skip', existing_ids: [9] }),
    ]
    const actions = { ...defaultActions(groups), b: 'replace' as const }

    expect(decisionsFor(groups, actions)).toEqual([
      { key: 'a', action: 'create', existing_ids: [] },
      { key: 'b', action: 'replace', existing_ids: [9] },
    ])
    expect(countByAction(groups, actions)).toEqual({ create: 1, update: 0, replace: 1, skip: 0 })
  })
})
