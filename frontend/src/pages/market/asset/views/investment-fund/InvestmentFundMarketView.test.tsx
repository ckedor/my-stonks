import type { InvestmentFundProfile } from '@/api/market'
import { renderWithTheme } from '@/theme/test-render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.hoisted` porque a fábrica do mock sobe para antes dos imports: uma const
// declarada aqui embaixo ainda não existiria quando ela roda.
const { fetchInvestmentFundProfile } = vi.hoisted(() => ({
  fetchInvestmentFundProfile: vi.fn(),
}))

vi.mock('@/api/market', () => ({ fetchInvestmentFundProfile }))

// O gráfico de cotação desenha em canvas, que o jsdom não tem — e ele não é o
// assunto deste teste: aqui se prova quais seções a tela abre.
vi.mock('@/pages/market/asset/AssetQuoteCard', () => ({
  default: () => <div>Cotação</div>,
}))

import InvestmentFundMarketView from './InvestmentFundMarketView'

const profile = (overrides: Partial<InvestmentFundProfile> = {}): InvestmentFundProfile => ({
  ticker: 'JURO11',
  identity: {
    cnpj: '42730834000100',
    legal_name: 'SPARTA INFRA FIC FI INFRA RENDA FIXA CP',
    kind: 'fiinfra',
    isin: null,
    cvm_class_type: null,
    cvm_classification: null,
    anbima_classification: null,
    b3_classification: 'Financeiro/Fundos/FI-INFRA',
    administrator_name: 'Sparta Administradora de Recursos',
    administrator_cnpj: null,
    manager_name: null,
    manager_cnpj: null,
    status: null,
  },
  indicators: {
    as_of_date: '2026-06-18',
    price: 96.99,
    nav_per_share: 99.19945,
    price_to_nav: 0.9777272,
    equity: 2_040_699_000,
    total_assets: 2_041_704_100,
    shareholders: 92_710,
    daily_applications: 0,
    daily_redemptions: 0,
    shares_outstanding: null,
    monthly_return: 0.0142,
    patrimonial_monthly_return: 0.0138,
    dividend_yield_monthly: 0.0051,
  },
  nav_history: [
    {
      date: '2026-06-17',
      class_or_series: null,
      nav_per_share: 99.1,
      equity: 2_039_000_000,
      total_assets: 2_040_000_000,
      shareholders: 92_700,
      daily_applications: 0,
      daily_redemptions: 0,
      monthly_return: null,
    },
    {
      date: '2026-06-18',
      class_or_series: null,
      nav_per_share: 99.19945,
      equity: 2_040_699_000,
      total_assets: 2_041_704_100,
      shareholders: 92_710,
      daily_applications: 0,
      daily_redemptions: 0,
      monthly_return: null,
    },
  ],
  dividends: [
    {
      payment_date: '2026-05-14',
      ex_date: '2026-04-28',
      declared_date: '2026-04-28',
      value_per_share: 0.48,
      event_type: 'RENDIMENTO',
    },
    {
      payment_date: '2026-06-13',
      ex_date: '2026-05-29',
      declared_date: '2026-05-29',
      value_per_share: 0.5,
      event_type: 'RENDIMENTO',
    },
  ],
  regulatory_profile: {
    reference_date: '2026-05-31',
    investors: {
      individual_retail: 0,
      individual_retail_percent: 0,
      legal_entities: 0,
      legal_entities_percent: 0,
      funds_or_clubs: 1,
      funds_or_clubs_percent: 100,
      non_residents: 0,
      non_residents_percent: 0,
      other: 0,
      other_percent: 0,
    },
    risk: {
      risk_model: 'Modelos Não-Paramétricos',
      portfolio_var: 0,
      daily_quota_variation_percent: 0,
      stressed_daily_quota_variation_percent: 0,
      private_credit_exposure_percent: 0,
    },
    top_investor_percent: 0,
    private_credit_exposure_percent: 0,
  },
  portfolio: {
    reference_date: '2026-05-31',
    summary: {
      market_value: 2_083_851_261,
      holdings_count: 7,
      public_bonds_value: 6_403_800,
      fund_holdings_value: 2_053_162_240,
      credit_assets_value: 0,
      listed_securities_value: 0,
      receivables_value: 12_371_910,
      payables_value: 11_913_311,
    },
    holdings: [
      {
        bucket: 'public_bonds',
        asset_type: 'Título público federal',
        asset_name: 'NOTAS DO TESOURO NACIONAL SERIE B',
        issuer_name: null,
        issuer_cnpj: null,
        isin: 'BRSTNCNTB716',
        selic_code: '760199',
        quantity: 1434,
        market_value: 6_403_800,
        cost_value: null,
        maturity_date: '2029-05-15',
        confidential: false,
        details: { applicationType: 'Operações Compromissadas' },
      },
    ],
  },
  ...overrides,
})

const renderView = () =>
  renderWithTheme(
    <InvestmentFundMarketView
      assetId={42}
      ticker="JURO11"
      candleData={[]}
      priceFormatter={String}
    />,
  )

describe('InvestmentFundMarketView', () => {
  beforeEach(() => {
    fetchInvestmentFundProfile.mockReset()
  })

  it('opens on the payments, with one tab per section the fund published', async () => {
    fetchInvestmentFundProfile.mockResolvedValue(profile())
    renderView()

    expect(await screen.findByRole('tab', { name: 'Rendimentos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    for (const label of ['Valor da cota', 'Indicadores', 'Carteira', 'Perfil mensal', 'Fundo']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByText('Rendimentos por cota')).toBeInTheDocument()
  })

  it('does not offer a Perfil mensal tab to a fund that files none', async () => {
    // Um FIP não entrega esse informe. Uma aba vazia faria o leitor procurar o
    // que não existe.
    fetchInvestmentFundProfile.mockResolvedValue(
      profile({ regulatory_profile: null, portfolio: null }),
    )
    renderView()

    expect(await screen.findByRole('tab', { name: 'Rendimentos' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Perfil mensal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Carteira' })).not.toBeInTheDocument()
  })

  it('swaps the panel below when another section is chosen', async () => {
    fetchInvestmentFundProfile.mockResolvedValue(profile())
    renderView()

    fireEvent.click(await screen.findByRole('tab', { name: 'Carteira' }))

    expect(screen.getByText('Carteira do fundo')).toBeInTheDocument()
    expect(screen.queryByText('Rendimentos por cota')).not.toBeInTheDocument()
  })

  it('keeps the decision above the price chart', async () => {
    // Nascendo só depois da resposta, a faixa empurraria o gráfico para baixo
    // com a tela já lida.
    fetchInvestmentFundProfile.mockResolvedValue(profile())
    renderView()

    const chart = await screen.findByText('Cotação')
    const verdict = screen.getByText(/abaixo do valor patrimonial/)
    expect(verdict.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says why there is no P/VP for a fund whose share does not trade', async () => {
    // Um fundo fechado sem preço de mercado não tem P/VP, o que é diferente de
    // o provedor não ter publicado o dele. Um travessão não distingue os dois.
    fetchInvestmentFundProfile.mockResolvedValue(
      profile({
        indicators: { ...profile().indicators!, price: null, price_to_nav: null },
      }),
    )
    renderView()

    expect(await screen.findByText(/Sem preço de mercado publicado/)).toBeInTheDocument()
  })

  it('reports a refused profile instead of drawing a page of empty sections', async () => {
    fetchInvestmentFundProfile.mockRejectedValue(new Error('brapi is down'))
    renderView()

    expect(await screen.findByText('Não foi possível carregar os dados do fundo.')).toBeInTheDocument()
  })
})
