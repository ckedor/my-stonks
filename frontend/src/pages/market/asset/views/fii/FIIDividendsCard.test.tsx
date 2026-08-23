import type { FIIDividend } from '@/api/market'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithTheme } from '@/theme/test-render'
import FIIDividendsCard from './FIIDividendsCard'

const payment = (
  payment_date: string,
  value_per_share: number,
  event_type: string | null = 'RENDIMENTO',
): FIIDividend => ({ payment_date, ex_date: null, value_per_share, event_type })

const renderCard = (dividends: FIIDividend[]) =>
  renderWithTheme(<FIIDividendsCard dividends={dividends} />)

describe('FIIDividendsCard', () => {
  it('sums the trailing year from the last payment, not from today', () => {
    renderCard([
      payment('2026-05-15', 0.9),
      payment('2026-06-15', 0.95),
      payment('2026-07-15', 1.0),
    ])

    expect(screen.getByText(/Último R\$\s?1,00 em 15\/07\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/12 meses R\$\s?2,85/)).toBeInTheDocument()
  })

  it('leaves amortizations out of the income it reports, and says so', () => {
    renderCard([
      payment('2026-06-15', 0.95),
      payment('2026-07-20', 4.0, 'AMORTIZACAO'),
    ])

    // The 4.00 returned as capital must not reach the trailing-year income.
    expect(screen.getByText(/12 meses R\$\s?0,95/)).toBeInTheDocument()
    expect(screen.getByText(/1 amortização de capital/)).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?4,00\s?por cota/)).toBeInTheDocument()
  })

  it('reads unlabelled payments as income rather than dropping them', () => {
    renderCard([payment('2026-07-15', 0.8, null)])

    expect(screen.getByText(/Último R\$\s?0,80 em 15\/07\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/amortiza/)).not.toBeInTheDocument()
  })

  it('states that the provider returned nothing instead of rendering blank', () => {
    renderCard([])

    expect(
      screen.getByText('O provedor não retornou rendimentos para este fundo.'),
    ).toBeInTheDocument()
  })
})
