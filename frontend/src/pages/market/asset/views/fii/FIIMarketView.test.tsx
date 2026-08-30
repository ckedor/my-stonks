import type { FIIProfile } from '@/api/market'
import { renderWithTheme } from '@/theme/test-render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.hoisted` porque a fábrica do mock sobe para antes dos imports: uma
// const declarada aqui embaixo ainda não existiria quando ela roda.
const { fetchFIIProfile } = vi.hoisted(() => ({ fetchFIIProfile: vi.fn() }))

vi.mock('@/api/market', () => ({ fetchFIIProfile }))

// O gráfico de cotação desenha em canvas, que o jsdom não tem — e ele não é o
// assunto deste teste: aqui se prova quais seções a tela abre.
vi.mock('@/pages/market/asset/AssetQuoteCard', () => ({
  default: () => <div>Cotação</div>,
}))

import FIIMarketView from './FIIMarketView'

const summary = {
  count: 37,
  total_area: 2066028.32,
  vacancy_rate: 0.032785,
  average_vacancy_rate: 0.03787,
  properties_with_vacancy: 37,
}

const profile = (overrides: Partial<FIIProfile> = {}): FIIProfile => ({
  ticker: 'HGLG11',
  management: {
    cnpj: '11728688000147',
    mandate: 'Renda',
    management_type: 'Ativa',
    administrator_name: 'BTG Pactual',
    administrator_website: 'www.btgpactual.com',
  },
  indicators: {
    as_of_date: '2025-12-01',
    segment_type: 'tijolo',
    segment: 'Logística',
    price: 155.4,
    nav_per_share: 160.55,
    price_to_nav: 0.9679,
    dividend_yield_12m: 0.0874,
    dividend_yield_1m: 0.0073,
    monthly_return: 0.0081,
    equity: 5_000_000_000,
    total_assets: 5_200_000_000,
    shares_outstanding: 31_000_000,
    shareholders: 320_000,
  },
  indicators_history: [],
  dividends: [
    { payment_date: '2025-11-15', ex_date: null, value_per_share: 1.1, event_type: 'RENDIMENTO' },
    { payment_date: '2025-12-15', ex_date: null, value_per_share: 1.14, event_type: 'RENDIMENTO' },
  ],
  monthly_report: null,
  composition: {
    reference_date: '2026-03-31',
    summary: {
      total_items: 40,
      declared_value: 3349501.49,
      properties: summary,
      financial_assets_count: 3,
      financial_assets_value: 3349501.49,
      lands_count: 0,
      lands_area: null,
      rights_count: 0,
      rights_value: null,
    },
    allocations: [],
    properties: [
      {
        name: 'Galpão de Embu',
        identifier: 'a1',
        address: 'Embu das Artes, SP',
        property_class: 'Imóveis para renda acabados',
        area: 77587.2,
        unit_count: 1,
        vacancy_rate: 0.1353,
        delinquency_rate: 0,
        revenue_share: 0.0398,
        leased_rate: null,
        sold_rate: null,
        construction_progress_actual: null,
        construction_progress_expected: null,
        construction_cost_actual: null,
        construction_cost_expected: null,
        invested_share: null,
        confidential: false,
      },
    ],
    financial_assets: [],
    fund_holdings: [],
    lands: [],
    rights: [],
  },
  composition_history: [],
  properties_history: [{ reference_date: '2026-03-31', summary }],
  ...overrides,
})

const renderView = () =>
  renderWithTheme(
    <FIIMarketView assetId={11} ticker="HGLG11" candleData={[]} priceFormatter={String} />,
  )

describe('FIIMarketView', () => {
  beforeEach(() => {
    fetchFIIProfile.mockReset()
  })

  it('opens on the payments, with one tab per section the fund published', async () => {
    fetchFIIProfile.mockResolvedValue(profile())
    renderView()

    expect(await screen.findByRole('tab', { name: 'Rendimentos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    for (const label of ['Indicadores', 'Imóveis', 'Carteira', 'Fundo']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    // O informe mensal não veio neste perfil, então não vira aba.
    expect(screen.queryByRole('tab', { name: 'Informe mensal' })).not.toBeInTheDocument()
    expect(screen.getByText('Rendimentos por cota')).toBeInTheDocument()
  })

  it('does not offer an Imóveis tab to a fund without buildings', async () => {
    // Uma aba vazia faria o leitor procurar o que não existe; quem diz que o
    // fundo é de papel é a faixa de decisão.
    fetchFIIProfile.mockResolvedValue(
      profile({
        composition: null,
        properties_history: [],
      }),
    )
    renderView()

    expect(await screen.findByRole('tab', { name: 'Rendimentos' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Imóveis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Carteira' })).not.toBeInTheDocument()
  })

  it('swaps the panel below when another section is chosen', async () => {
    fetchFIIProfile.mockResolvedValue(profile())
    renderView()

    fireEvent.click(await screen.findByRole('tab', { name: 'Imóveis' }))

    expect(screen.getByText('Imóveis e vacância')).toBeInTheDocument()
    expect(screen.queryByText('Rendimentos por cota')).not.toBeInTheDocument()
  })

  it('keeps the decision above the price chart, both while loading and after', async () => {
    // Nascendo só depois da resposta, a faixa empurraria o gráfico para baixo
    // com a tela já lida.
    fetchFIIProfile.mockResolvedValue(profile())
    renderView()

    const chart = await screen.findByText('Cotação')
    const verdict = screen.getByText(/abaixo do valor patrimonial/)
    expect(verdict.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
