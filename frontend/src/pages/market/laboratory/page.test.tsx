import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme as render } from '@/theme/test-render'
import MarketLaboratoryPage from './page'

const runBacktest = vi.fn()

vi.mock('@/api/lab', async () => {
  const actual = await vi.importActual<typeof import('@/api/lab')>('@/api/lab')
  return {
    ...actual,
    fetchTheoreticalPortfolios: () => Promise.resolve([]),
    fetchPresets: () =>
      Promise.resolve([
        {
          key: '60-40',
          name: '60/40 Brasil',
          description: 'Sessenta em bolsa, quarenta no CDI.',
          contribution_frequency: 'monthly',
          rebalance_frequency: 'annual',
          lines: [
            {
              label: 'Ibovespa',
              series_id: 6,
              weight: 60,
              fixed_income_type_id: null,
              rate: null,
            },
            { label: 'CDI', series_id: 3, weight: 40, fixed_income_type_id: null, rate: null },
          ],
        },
      ]),
    runBacktest: (payload: unknown) => {
      runBacktest(payload)
      return Promise.resolve({
        label: '60/40 Brasil',
        window: {
          start_date: '2020-01-02',
          end_date: '2025-01-02',
          limited_by: null,
          requested_start_date: null,
        },
        series: [{ date: '2020-01-02', value: 10000, invested: 10000, acc_return: 0 }],
        lines: [
          {
            key: 'series:6:null:null',
            label: 'Ibovespa',
            target_weight: 60,
            final_weight: 62,
            final_value: 6200,
          },
        ],
        final_value: 10000,
        invested: 10000,
        profit: 0,
        contributions: 12,
        rebalances: 1,
        analysis: null,
      })
    },
  }
})

vi.mock('@/api/market', () => ({
  fetchAssetCatalogue: () =>
    Promise.resolve([
      {
        id: 42,
        ticker: 'PETR4',
        name: 'Petrobras PN',
        asset_type_id: 4,
        asset_type: { id: 4, short_name: 'Ação', name: 'Ação' },
      },
    ]),
  fetchMarketDataSeriesOptions: () =>
    Promise.resolve([
      { id: 3, short_name: 'CDI', name: 'CDI', symbol: 'CDI' },
      { id: 6, short_name: 'IBOV', name: 'Ibovespa', symbol: 'IBOV' },
    ]),
}))

vi.mock('@/api/research', () => ({ fetchRecommendedPortfolios: () => Promise.resolve([]) }))

vi.mock('@/queries/portfolio', () => ({ usePositions: () => ({ data: [] }) }))

/* O gráfico usa lightweight-charts, que precisa de layout de verdade; a tela
   não é sobre ele. */
vi.mock('@/components/PortfolioReturnsChart', () => ({
  default: () => <div>curva</div>,
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <MarketLaboratoryPage />
    </MemoryRouter>,
  )

describe('MarketLaboratoryPage', () => {
  it('opens on the workbench with nothing allocated yet', async () => {
    renderPage()

    expect(await screen.findByText('Laboratório')).toBeInTheDocument()
    expect(await screen.findByText('0.0%')).toBeInTheDocument()
  })

  it('seeds the draft from a preset and shows the weights adding to 100', async () => {
    renderPage()
    await screen.findByText('Laboratório')

    fireEvent.mouseDown(screen.getByLabelText('Modelo'))
    fireEvent.click(await screen.findByRole('option', { name: '60/40 Brasil' }))

    expect(await screen.findByText('Ibovespa')).toBeInTheDocument()
    expect(await screen.findByText('100.0%')).toBeInTheDocument()
  })

  /* A soma dos pesos é o sinal que evita simular uma carteira que não é a que
     se desenhou. O motor normaliza, mas 90% somados quase sempre é engano. */
  it('warns when the weights do not add to one hundred', async () => {
    renderPage()
    await screen.findByText('Laboratório')

    fireEvent.mouseDown(screen.getByLabelText('Modelo'))
    fireEvent.click(await screen.findByRole('option', { name: '60/40 Brasil' }))
    await screen.findByText('Ibovespa')

    // Um campo numérico é `spinbutton`; `Peso` também casa o rótulo, que não
    // tem setter de valor.
    const weights = await screen.findAllByRole('spinbutton', { name: 'Peso' })
    fireEvent.change(weights[0], { target: { value: '30' } })

    expect(await screen.findByText(/normaliza para 100%/)).toBeInTheDocument()
  })

  it('sends the whole allocation to the backtest, not a saved id', async () => {
    renderPage()
    await screen.findByText('Laboratório')

    fireEvent.mouseDown(screen.getByLabelText('Modelo'))
    fireEvent.click(await screen.findByRole('option', { name: '60/40 Brasil' }))
    await screen.findByText('Ibovespa')

    fireEvent.click(screen.getByRole('button', { name: 'Rodar simulação' }))

    await waitFor(() => expect(runBacktest).toHaveBeenCalled())
    const payload = runBacktest.mock.calls[0][0]
    expect(payload.positions).toHaveLength(2)
    expect(payload.positions[0]).toMatchObject({ series_id: 6, weight: 60 })
    expect(payload.rebalance_frequency).toBe('annual')
  })

  it('shows the result once the simulation answers', async () => {
    renderPage()
    await screen.findByText('Laboratório')

    fireEvent.mouseDown(screen.getByLabelText('Modelo'))
    fireEvent.click(await screen.findByRole('option', { name: '60/40 Brasil' }))
    await screen.findByText('Ibovespa')

    fireEvent.click(screen.getByRole('button', { name: 'Rodar simulação' }))

    expect(await screen.findByText('Resultado')).toBeInTheDocument()
    expect(await screen.findByText('Patrimônio final')).toBeInTheDocument()
  })
})
