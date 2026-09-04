import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithTheme as render } from '@/theme/test-render'
import MarketCataloguePage from './page'

vi.mock('@/api/market', () => ({
  fetchMarketCatalogue: () =>
    Promise.resolve({
      assets: [{
        asset_id: 42,
        ticker: 'TEST3',
        name: 'Ativo de teste',
        price: 12.5,
        change_percent: 1.25,
        volume: 100000,
        market_cap: 5000000,
        currency: 'BRL',
        logo_url: null,
      }],
      total: 1,
      source: 'brapi',
    }),
}))

vi.mock('@/pages/market/ativos/FavoriteAssets', () => ({
  default: () => <div>Mais acessados</div>,
}))

vi.mock('@/pages/market/components/MarketBenchmarkCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

describe('MarketCataloguePage', () => {
  it.each([
    ['br', 'Bolsa BR', 'IBOVESPA contra CDI'],
    ['us', 'Bolsa EUA', 'S&P 500 contra CDI'],
    ['crypto', 'Mercado de Criptoativos', 'Bitcoin contra CDI'],
  ] as const)('renders the %s market with the shared structure', async (market, title, benchmark) => {
    render(
      <MemoryRouter>
        <MarketCataloguePage market={market} />
      </MemoryRouter>,
    )

    // A resposta chega assíncrona, como na aplicação: a tabela pinta depois
    // da primeira resposta, e não no mesmo tick do render.
    expect(await screen.findByText('TEST3')).toBeVisible()
    expect(screen.getByRole('heading', { name: title })).toBeVisible()
    expect(screen.getByText('Mais acessados')).toBeVisible()
    expect(screen.getByText(benchmark)).toBeVisible()
    expect(screen.queryByText('Segmento')).not.toBeInTheDocument()
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument()
  })

  it('navigates from the whole table row', async () => {
    render(
      <MemoryRouter initialEntries={['/market/br']}>
        <Routes>
          <Route path="/market/br" element={<MarketCataloguePage market="br" />} />
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('TEST3'))

    expect(screen.getByTestId('location')).toHaveTextContent('/market/asset/42')
  })
})
