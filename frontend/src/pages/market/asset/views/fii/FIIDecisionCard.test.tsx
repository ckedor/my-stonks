import type { FIIDividend, FIIProfile } from '@/api/market'
import { renderWithTheme } from '@/theme/test-render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import FIIDecisionCard from './FIIDecisionCard'

const payment = (
  payment_date: string,
  value_per_share: number,
  event_type: string | null = 'RENDIMENTO',
): FIIDividend => ({ payment_date, ex_date: null, value_per_share, event_type })

const profile = (overrides: Partial<FIIProfile> = {}): FIIProfile => ({
  ticker: 'MXRF11',
  management: null,
  indicators: {
    as_of_date: '2025-12-01',
    segment_type: 'papel',
    segment: 'Papéis',
    price: 9.58,
    nav_per_share: 9.409927,
    price_to_nav: 1.0180738,
    dividend_yield_12m: 0.12381,
    dividend_yield_1m: 0.009328,
    monthly_return: 0.007876,
    equity: 4331102700,
    total_assets: 4375755000,
    shares_outstanding: 460269540,
    shareholders: 1357621,
  },
  indicators_history: [],
  dividends: [payment('2025-11-01', 0.098), payment('2025-12-01', 0.089)],
  monthly_report: null,
  composition: null,
  composition_history: [],
  properties_history: [],
  ...overrides,
})

describe('FIIDecisionCard', () => {
  it('reads the P/VP as a sentence, dated by the filing it came from', () => {
    renderWithTheme(<FIIDecisionCard profile={profile()} />)

    expect(screen.getByText('1,81% acima do valor patrimonial')).toBeInTheDocument()
    // A data não é enfeite: o preço ao lado é o do informe, não a cotação de
    // agora — que está no gráfico logo abaixo.
    expect(screen.getByText(/informe de 01\/12\/2025/)).toBeInTheDocument()
  })

  it('writes the yield and the payment as different grandezas', () => {
    renderWithTheme(<FIIDecisionCard profile={profile()} />)

    expect(screen.getByText('12,38%')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s?0,089/)).toBeInTheDocument()
  })

  it('says which way the last payment moved, and against what', () => {
    renderWithTheme(<FIIDecisionCard profile={profile()} />)

    expect(screen.getByText(/Caiu 9,18% vs 01\/11\/2025/)).toBeInTheDocument()
  })

  it('does not invent a trend for a fund with a single payment', () => {
    renderWithTheme(
      <FIIDecisionCard profile={profile({ dividends: [payment('2025-12-01', 0.089)] })} />,
    )

    expect(screen.queryByText(/Caiu|Subiu/)).not.toBeInTheDocument()
    expect(screen.getByText(/pago em 01\/12\/2025/)).toBeInTheDocument()
  })

  it('states that the fund published no P/VP instead of showing a dash', () => {
    const indicators = profile().indicators
    renderWithTheme(
      <FIIDecisionCard
        profile={profile({ indicators: { ...indicators!, price_to_nav: null } })}
      />,
    )

    expect(screen.getByText('O fundo não publicou o P/VP deste mês.')).toBeInTheDocument()
  })

  it('names the strategy from the provider when there are no buildings', () => {
    renderWithTheme(<FIIDecisionCard profile={profile()} />)

    expect(screen.getByText('Sem imóveis físicos — fundo de papel.')).toBeInTheDocument()
  })

  it('stays neutral about a fund whose strategy the provider did not publish', () => {
    // Lista vazia não prova nada: um fundo de tijolo cujo informe atrasou
    // chega exatamente assim.
    const indicators = profile().indicators
    renderWithTheme(
      <FIIDecisionCard
        profile={profile({ indicators: { ...indicators!, segment_type: null } })}
      />,
    )

    expect(screen.getByText('Sem imóveis no informe trimestral.')).toBeInTheDocument()
  })

  it('shows the vacancy with how far it moved, and the quarter it refers to', () => {
    renderWithTheme(
      <FIIDecisionCard
        profile={profile({
          composition: {
            reference_date: '2026-03-31',
            summary: {
              total_items: 40,
              declared_value: 3349501.49,
              properties: {
                count: 37,
                total_area: 2066028.32,
                vacancy_rate: 0.032785,
                average_vacancy_rate: 0.03787,
                properties_with_vacancy: 37,
              },
              financial_assets_count: 3,
              financial_assets_value: 3349501.49,
              lands_count: 0,
              lands_area: null,
              rights_count: 0,
              rights_value: null,
            },
            allocations: [],
            properties: [],
            financial_assets: [],
            fund_holdings: [],
            lands: [],
            rights: [],
          },
          properties_history: [
            {
              reference_date: '2025-12-31',
              summary: {
                count: 28,
                total_area: 1628383.15,
                vacancy_rate: 0.029088,
                average_vacancy_rate: 0.04282,
                properties_with_vacancy: 28,
              },
            },
            {
              reference_date: '2026-03-31',
              summary: {
                count: 37,
                total_area: 2066028.32,
                vacancy_rate: 0.032785,
                average_vacancy_rate: 0.03787,
                properties_with_vacancy: 37,
              },
            },
          ],
        })}
      />,
    )

    expect(screen.getByText('3,28%')).toBeInTheDocument()
    expect(screen.getByText('+0,37 p.p.')).toBeInTheDocument()
    expect(screen.getByText(/Informe trimestral de 31\/03\/2026/)).toBeInTheDocument()
  })
})
