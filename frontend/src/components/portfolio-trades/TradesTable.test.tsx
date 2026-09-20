import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeRegistry } from '@/theme'
import type { Trade } from '@/types'
import TradesTable from './TradesTable'

/* Nem todo ativo tem ticker. Um fundo cadastrado pelo registro do regulador —
   um FIDC, por exemplo — não é negociado em bolsa e não tem código, e a coluna
   `asset.ticker` é nula por isso. A operação dele aparece em /trades como
   qualquer outra, e a tabela não pode quebrar por causa dela. */

const trade = (overrides: Partial<Trade> = {}): Trade => ({
  id: 1,
  asset_id: 10,
  date: new Date('2026-03-04'),
  ticker: 'PETR4',
  type: 'Compra',
  quantity: 100,
  price: 38.5,
  value: 3850,
  average_price: 38.5,
  broker: 'Clear',
  broker_id: 2,
  realized_profit: 0,
  acc_quantity: 100,
  position: 3850,
  profit_pct: 0,
  portfolio_id: 1,
  original_price: 38.5,
  currency: 'BRL',
  ...overrides,
})

function renderTable(trades: Trade[]) {
  return render(
    <ThemeRegistry>
      <TradesTable trades={trades} />
    </ThemeRegistry>,
  )
}

describe('TradesTable', () => {
  it('identifica pelo ticker o ativo que tem um', () => {
    renderTable([trade()])

    expect(screen.getByText('PETR4')).toBeInTheDocument()
  })

  it('identifica pelo nome o fundo sem ticker', () => {
    renderTable([trade({ ticker: null, name: 'Fundo Equipe' })])

    expect(screen.getByText('Fundo Equipe')).toBeInTheDocument()
  })

  it('desenha o ativo sem ticker sem quebrar', () => {
    renderTable([trade({ ticker: null })])

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
