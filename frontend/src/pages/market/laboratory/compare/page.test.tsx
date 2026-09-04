import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme as render } from '@/theme/test-render'
import MarketLaboratoryComparePage from './page'

const compareBacktests = vi.fn()

const portfolio = (id: number, name: string) => ({
  id,
  name,
  initial_amount: 10000,
  contribution_amount: 1000,
  contribution_frequency: 'monthly' as const,
  rebalance_frequency: 'annual' as const,
  benchmark_id: null,
  positions: [
    {
      id: id * 10,
      weight: 100,
      asset_id: null,
      series_id: 6,
      fixed_income_type_id: null,
      rate: null,
      label: 'Ibovespa',
    },
  ],
})

const result = (label: string, finalValue: number) => ({
  label,
  window: {
    start_date: '2020-01-02',
    end_date: '2025-01-02',
    limited_by: null,
    requested_start_date: null,
  },
  series: [{ date: '2020-01-02', value: 10000, invested: 10000, acc_return: 0 }],
  lines: [],
  final_value: finalValue,
  invested: 10000,
  profit: finalValue - 10000,
  contributions: 12,
  rebalances: 1,
  analysis: null,
})

let saved = [portfolio(1, 'Conservadora'), portfolio(2, 'Agressiva')]

vi.mock('@/api/lab', async () => {
  const actual = await vi.importActual<typeof import('@/api/lab')>('@/api/lab')
  return {
    ...actual,
    fetchTheoreticalPortfolios: () => Promise.resolve(saved),
    fetchPresets: () => Promise.resolve([]),
    compareBacktests: (runs: unknown) => {
      compareBacktests(runs)
      return Promise.resolve([result('Conservadora', 12000), result('Agressiva', 15000)])
    },
  }
})

vi.mock('@/api/market', () => ({
  fetchAssetCatalogue: () => Promise.resolve([]),
  fetchMarketDataSeriesOptions: () =>
    Promise.resolve([{ id: 3, short_name: 'CDI', name: 'CDI', symbol: 'CDI' }]),
}))

vi.mock('@/api/research', () => ({ fetchRecommendedPortfolios: () => Promise.resolve([]) }))

vi.mock('@/components/PortfolioReturnsChart', () => ({ default: () => <div>curva</div> }))

const renderPage = () =>
  render(
    <MemoryRouter>
      <MarketLaboratoryComparePage />
    </MemoryRouter>,
  )

describe('MarketLaboratoryComparePage', () => {
  it('asks for two saved portfolios before it can compare anything', async () => {
    saved = []
    renderPage()

    expect(await screen.findByText('Faltam carteiras para comparar')).toBeInTheDocument()
    saved = [portfolio(1, 'Conservadora'), portfolio(2, 'Agressiva')]
  })

  /* O regime é compartilhado de propósito: duas carteiras com aportes
     diferentes comparariam duas coisas ao mesmo tempo. */
  it('runs both carteiras under the same window and contribution regime', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Comparador' })

    fireEvent.mouseDown(screen.getByLabelText('Primeira'))
    fireEvent.click(await screen.findByRole('option', { name: 'Conservadora' }))
    fireEvent.mouseDown(screen.getByLabelText('Segunda'))
    fireEvent.click(await screen.findByRole('option', { name: 'Agressiva' }))

    fireEvent.click(screen.getByRole('button', { name: 'Comparar' }))

    await waitFor(() => expect(compareBacktests).toHaveBeenCalled())
    const runs = compareBacktests.mock.calls[0][0]
    expect(runs).toHaveLength(2)
    expect(runs[0].label).toBe('Conservadora')
    expect(runs[1].label).toBe('Agressiva')
    expect(runs[0].years).toBe(runs[1].years)
    expect(runs[0].contribution_frequency).toBe(runs[1].contribution_frequency)
    expect(runs[0].rebalance_frequency).toBe(runs[1].rebalance_frequency)
  })

  it('shows one column per carteira in the metric table', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Comparador' })

    fireEvent.mouseDown(screen.getByLabelText('Primeira'))
    fireEvent.click(await screen.findByRole('option', { name: 'Conservadora' }))
    fireEvent.mouseDown(screen.getByLabelText('Segunda'))
    fireEvent.click(await screen.findByRole('option', { name: 'Agressiva' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comparar' }))

    expect(await screen.findByText('Lado a lado')).toBeInTheDocument()
    expect(await screen.findByText('Patrimônio final')).toBeInTheDocument()
  })

  it('says so when both selections are the same carteira', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Comparador' })

    fireEvent.mouseDown(screen.getByLabelText('Primeira'))
    fireEvent.click(await screen.findByRole('option', { name: 'Conservadora' }))
    fireEvent.mouseDown(screen.getByLabelText('Segunda'))
    fireEvent.click(await screen.findByRole('option', { name: 'Conservadora' }))

    expect(
      await screen.findByText('As duas seleções são a mesma carteira.'),
    ).toBeInTheDocument()
  })
})
