import type { EtfHoldingsPage, EtfProfile } from '@/api/etf'
import { renderWithTheme } from '@/theme/test-render'
import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchEtfProfile, fetchEtfHoldings } = vi.hoisted(() => ({
  fetchEtfProfile: vi.fn(),
  fetchEtfHoldings: vi.fn(),
}))

vi.mock('@/api/etf', () => ({ fetchEtfProfile, fetchEtfHoldings }))

// O gráfico desenha em canvas, que o jsdom não tem, e não é o assunto aqui.
vi.mock('@/pages/market/asset/AssetQuoteCard', () => ({
  default: () => <div>Cotação</div>,
}))

import EtfMarketView from './EtfMarketView'

const IVV: EtfProfile = {
  registry: 'sec',
  fund: {
    name: 'iShares Core S&P 500 ETF',
    lei: '5493007M4YMN8XL48C14',
    sec_series_id: 'S000004310',
    domicile: 'US',
    status: 'active',
    tracks_index: true,
    leveraged_or_inverse: false,
    fund_of_funds: false,
    umbrella: { name: 'iShares Trust', lei: null, cnpj: null, country: 'US' },
    managers: [{ name: 'BlackRock Fund Advisors', lei: null, cnpj: null, country: 'US' }],
  },
  share_class: {
    name: 'iShares Core S&P 500 ETF',
    ticker: 'IVV',
    isin: null,
    sec_class_id: 'C000012040',
    currency: 'USD',
    distribution_policy: null,
    cfi_code: null,
    status: 'active',
  },
  cvm_fund: null,
  holdings: {
    report_date: '2026-06-30',
    source: 'sec_nport',
    net_assets: 888_128_937_468,
    total_assets: 889_637_196_076,
    holdings_count: 508,
    fetched_at: null,
  },
  holdings_available: true,
}

const holding = (rank: number, name: string, weight: number) => ({
  rank,
  name,
  isin: null,
  ticker: null,
  asset_id: null,
  asset_category: 'EC',
  country: 'US',
  currency: 'USD',
  balance: null,
  units: 'NS',
  value_usd: weight * 888_128_937_468,
  weight,
})

const page = (number: number): EtfHoldingsPage => ({
  report_date: '2026-06-30',
  source: 'sec_nport',
  total: 508,
  page: number,
  page_size: 10,
  items:
    number === 1
      ? [
          { ...holding(1, 'NVIDIA Corp.', 0.0751), asset_id: 3063 },
          holding(2, 'Apple, Inc.', 0.0658),
        ]
      : [holding(21, 'Walmart, Inc.', 0.0072)],
})

const renderView = () =>
  renderWithTheme(
    <MemoryRouter>
      <EtfMarketView
        assetId={55}
        ticker="IVV"
        candleData={[]}
        priceFormatter={(value) => String(value)}
      />
    </MemoryRouter>
  )

describe('EtfMarketView', () => {
  beforeEach(() => {
    fetchEtfProfile.mockReset()
    fetchEtfHoldings.mockReset()
  })

  it('lists the holdings largest first, with the report they come from', async () => {
    fetchEtfProfile.mockResolvedValue(IVV)
    fetchEtfHoldings.mockImplementation((_id, number) => Promise.resolve(page(number)))

    renderView()

    // A posição ligada a um ativo do app é um link para a página dele.
    expect(await screen.findByRole('link', { name: 'NVIDIA Corp.' })).toHaveAttribute(
      'href',
      '/market/asset/3063'
    )
    expect(screen.queryByRole('link', { name: 'Apple, Inc.' })).not.toBeInTheDocument()
    expect(screen.getByText('7,51%')).toBeInTheDocument()
    expect(screen.getByText(/Posição de 30\/06\/2026/)).toBeInTheDocument()
    expect(screen.getByText('BlackRock Fund Advisors')).toBeInTheDocument()
    expect(screen.getByText('Segue um índice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(await screen.findByText('Walmart, Inc.')).toBeInTheDocument()
    expect(fetchEtfHoldings).toHaveBeenLastCalledWith(55, 2, 10)
  })

  it('says why a UCITS ETF has no holdings instead of an empty table', async () => {
    fetchEtfProfile.mockResolvedValue({
      ...IVV,
      registry: 'esma',
      holdings: null,
      holdings_available: false,
      fund: { ...IVV.fund!, domicile: 'IE', sec_series_id: null },
      share_class: { ...IVV.share_class!, distribution_policy: 'accumulating' },
    })

    renderView()

    expect(await screen.findByText(/Nenhum regulador publica a carteira/)).toBeInTheDocument()
    expect(screen.getByText('Acumula proventos')).toBeInTheDocument()
    expect(screen.getByText('Domicílio: Irlanda')).toBeInTheDocument()
    expect(fetchEtfHoldings).not.toHaveBeenCalled()
  })
})
