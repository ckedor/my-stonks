import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeRegistry } from '@/theme'
import ClosedPositionList from './ClosedPositionList'
import type { ClosedPositionEntry } from '@/types'

vi.mock('@/queries/portfolio', () => ({
  useSelectedPortfolio: () => ({ id: 1, custom_categories: [] }),
  useRefreshPortfolio: () => vi.fn(),
}))

const sold: ClosedPositionEntry = {
  asset_id: 42,
  ticker: 'MGLU3',
  name: 'Magazine Luiza',
  type: 'Ação',
  category: 'Ações',
  entry_date: '2021-02-10',
  exit_date: '2023-11-30',
  days_held: 1023,
  quantity_sold: 500,
  average_price: 18.4,
  average_sale_price: 11.2,
  total_invested: 9200,
  gross_sales: 5600,
  realized_profit: -3600,
  realized_profit_pct: -39.13,
  dividends: 120,
  acc_return: -0.3785,
  cagr: -0.1652,
}

function list(positions: ClosedPositionEntry[], search = '') {
  return render(
    <ThemeRegistry>
      <MemoryRouter>
        <ClosedPositionList positions={positions} search={search} />
      </MemoryRouter>
    </ThemeRegistry>,
  )
}

describe('closed positions', () => {
  it('shows the round trip: when it ended and what it realized', () => {
    list([sold])

    expect(screen.getByText('Magazine Luiza')).toBeInTheDocument()
    expect(screen.getByText(/30\/11\/2023/)).toBeInTheDocument()
    expect(screen.getByText('-39,13%')).toBeInTheDocument()
  })

  it('finds a position by name regardless of case', () => {
    list([sold], 'mAgAzInE')
    expect(screen.getByText('Magazine Luiza')).toBeInTheDocument()
  })

  it('says so when nothing was ever closed', () => {
    list([])
    expect(screen.getByText(/Nenhum ativo encerrado/)).toBeInTheDocument()
  })
})
