import type {
  FIIDividend,
  FIICompositionPoint,
  FIIIndicators,
  FIIMonthlyReport,
  FIIPropertiesPoint,
} from '@/api/market'
import { describe, expect, it } from 'vitest'

import { formatBRLPerShare, formatPercentagePoints } from './format'
import {
  compositionHistoryWithCurrentReport,
  incomeTrend,
  navReading,
  patrimonySlices,
  vacancyReading,
} from './readings'

const indicators = (overrides: Partial<FIIIndicators> = {}): FIIIndicators => ({
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
  ...overrides,
})

const payment = (
  payment_date: string,
  value_per_share: number,
  event_type: string | null = 'RENDIMENTO',
): FIIDividend => ({ payment_date, ex_date: null, value_per_share, event_type })

const quarter = (reference_date: string, vacancy_rate: number | null): FIIPropertiesPoint => ({
  reference_date,
  summary: {
    count: 37,
    total_area: 2066028.32,
    vacancy_rate,
    average_vacancy_rate: 0.03787,
    properties_with_vacancy: 37,
  },
})

describe('navReading', () => {
  it('turns the published P/VP into how far the share is from the fund’s own valuation', () => {
    const reading = navReading(indicators())

    expect(reading?.direction).toBe('above')
    expect(reading?.deviation).toBeCloseTo(0.0180738, 7)
    expect(reading?.asOfDate).toBe('2025-12-01')
  })

  it('reads a multiple below one as a discount', () => {
    expect(navReading(indicators({ price_to_nav: 0.968 }))?.direction).toBe('below')
  })

  it('says nothing when the fund did not publish the multiple', () => {
    // Os dois preços estão ali, e mesmo assim não há leitura: dividir um pelo
    // outro produziria um terceiro número, nosso, no lugar do que o fundo
    // declarou.
    expect(navReading(indicators({ price_to_nav: null }))).toBeNull()
    expect(navReading(null)).toBeNull()
  })
})

describe('incomeTrend', () => {
  it('compares the last two payments, whatever order they arrived in', () => {
    const trend = incomeTrend([
      payment('2025-12-01', 0.089),
      payment('2025-10-01', 0.095),
      payment('2025-11-01', 0.098),
    ])

    expect(trend?.last.payment_date).toBe('2025-12-01')
    expect(trend?.previous?.payment_date).toBe('2025-11-01')
    expect(trend?.change).toBeCloseTo(-0.0918, 4)
  })

  it('leaves amortizations out of the comparison', () => {
    // Uma amortização entre os dois faria a conta medir devolução de
    // principal contra renda do mês.
    const trend = incomeTrend([
      payment('2025-11-01', 0.098),
      payment('2025-11-20', 4, 'AMORTIZACAO'),
      payment('2025-12-01', 0.089),
    ])

    expect(trend?.previous?.value_per_share).toBe(0.098)
    expect(trend?.change).toBeCloseTo(-0.0918, 4)
  })

  it('reads an unlabelled payment as income', () => {
    const trend = incomeTrend([payment('2025-11-01', 0.098, null), payment('2025-12-01', 0.089)])

    expect(trend?.previous?.value_per_share).toBe(0.098)
  })

  it('has no variation to report on a fund with a single payment', () => {
    const trend = incomeTrend([payment('2025-12-01', 0.089)])

    expect(trend?.last.value_per_share).toBe(0.089)
    expect(trend?.previous).toBeNull()
    expect(trend?.change).toBeNull()
  })

  it('does not divide by a payment of zero', () => {
    const trend = incomeTrend([payment('2025-11-01', 0), payment('2025-12-01', 0.089)])

    expect(trend?.change).toBeNull()
  })

  it('says nothing when the fund never paid', () => {
    expect(incomeTrend([])).toBeNull()
    expect(incomeTrend([payment('2025-12-01', 4, 'AMORTIZACAO')])).toBeNull()
  })
})

describe('vacancyReading', () => {
  it('reads the current quarter and how far it moved from the one before', () => {
    const reading = vacancyReading({
      summary: null,
      history: [quarter('2026-03-31', 0.032785), quarter('2025-12-31', 0.029088)],
    })

    expect(reading?.rate).toBe(0.032785)
    expect(reading?.change).toBeCloseTo(0.003697, 6)
    expect(reading?.previousDate).toBe('2025-12-31')
  })

  it('prefers the itemized filing for the current numbers', () => {
    const reading = vacancyReading({
      summary: {
        count: 41,
        total_area: 2100000,
        vacancy_rate: 0.031,
        average_vacancy_rate: 0.036,
        properties_with_vacancy: 39,
      },
      history: [quarter('2025-12-31', 0.029088), quarter('2026-03-31', 0.032785)],
    })

    expect(reading?.count).toBe(41)
    // O delta continua saindo da série: misturar as duas fontes compararia
    // trimestres que podem não ser vizinhos.
    expect(reading?.change).toBeCloseTo(0.003697, 6)
  })

  it('has no delta with a single quarter', () => {
    const reading = vacancyReading({ summary: null, history: [quarter('2026-03-31', 0.0327)] })

    expect(reading?.rate).toBe(0.0327)
    expect(reading?.change).toBeNull()
    expect(reading?.previousDate).toBeNull()
  })

  it('says nothing about a fund with no buildings at all', () => {
    expect(vacancyReading({ summary: null, history: [] })).toBeNull()
  })

  it('has no delta when a quarter did not report vacancy', () => {
    const reading = vacancyReading({
      summary: null,
      history: [quarter('2025-12-31', null), quarter('2026-03-31', 0.0327)],
    })

    expect(reading?.change).toBeNull()
  })
})

describe('formatação das duas grandezas', () => {
  it('writes a payment per share to the cent that matters', () => {
    // Com duas casas, 0,089 e 0,098 viram o mesmo "R$ 0,09" — e entre eles há
    // quase 10%.
    expect(formatBRLPerShare(0.089)).toMatch(/R\$\s?0,089/)
    expect(formatBRLPerShare(0.098)).toMatch(/R\$\s?0,098/)
    expect(formatBRLPerShare(1.14)).toMatch(/R\$\s?1,14/)
    expect(formatBRLPerShare(null)).toBe('—')
  })

  it('writes a difference between rates in percentage points, with the sign', () => {
    expect(formatPercentagePoints(0.003697)).toBe('+0,37 p.p.')
    expect(formatPercentagePoints(-0.003697)).toBe('−0,37 p.p.')
    expect(formatPercentagePoints(0)).toBe('0,00 p.p.')
    expect(formatPercentagePoints(null)).toBe('—')
  })
})

const report = (overrides: Partial<FIIMonthlyReport> = {}): FIIMonthlyReport => ({
  reference_date: '2025-12-01',
  admin_fee_rate: 0.000753,
  monthly_patrimonial_return: -0.001452,
  amortization_rate: 0,
  equity: 4331102700,
  total_assets: 4375755000,
  total_invested: 4326274600,
  cash: 0,
  liquidity_needs: 24506374,
  government_bonds: 0,
  private_bonds: 0,
  fixed_income_funds: 24506374,
  real_estate: 9147060,
  real_estate_company_shares: 0,
  real_estate_company_units: 0,
  cri: 3354012400,
  lci: 0,
  fii_holdings: 538337660,
  receivables: 24973770,
  rental_receivables: 0,
  other_receivables: 24973770,
  distributions_payable: 41155660,
  admin_fees_payable: 3260833.2,
  real_estate_obligations: 0,
  total_liabilities: 44652356,
  ...overrides,
})

describe('patrimonySlices', () => {
  it('draws the monthly filing, which is the one that prices the buildings', () => {
    const drawn = patrimonySlices({
      report: report(),
      allocations: [{ asset_class: 'cri', count: 3, value: 3349501.49 }],
    })

    expect(drawn?.source).toBe('report')
    expect(drawn?.slices.map((slice) => slice.label)).toEqual([
      'Imóveis',
      'CRI',
      'Cotas de FII',
      'Outros recebíveis',
      'Fundos de renda fixa',
    ])
    // Linha filed como zero não vira fatia: ela não desenha setor e ainda
    // empurra um rótulo solto para a borda.
    expect(drawn?.slices.every((slice) => slice.value > 0)).toBe(true)
  })

  it('falls back to the quarterly filing when there is no monthly one', () => {
    const drawn = patrimonySlices({
      report: null,
      allocations: [
        { asset_class: 'real_estate', count: 37, value: null },
        { asset_class: 'cri', count: 3, value: 3349501.49 },
      ],
    })

    expect(drawn?.source).toBe('quarter')
    // O imóvel sem valor declarado fica de fora do desenho — e é por isso que
    // o card diz de qual informe a pizza veio.
    expect(drawn?.slices).toEqual([{ label: 'CRI', value: 3349501.49 }])
  })

  it('draws nothing when neither filing priced anything', () => {
    expect(
      patrimonySlices({
        report: null,
        allocations: [{ asset_class: 'real_estate', count: 37, value: null }],
      }),
    ).toBeNull()
    expect(patrimonySlices({ report: null, allocations: [] })).toBeNull()
  })
})

const compositionPoint = (
  reference_date: string,
  allocations: FIICompositionPoint['allocations'],
): FIICompositionPoint => ({ reference_date, summary: null, allocations })

describe('compositionHistoryWithCurrentReport', () => {
  it('completes an omitted CRI in the current quarter from the monthly report', () => {
    const history = [
      compositionPoint('2026-03-31', [
        { asset_class: 'cri', count: 98, value: 683_324_870.21 },
      ]),
      compositionPoint('2026-06-30', [
        { asset_class: 'fii', count: 13, value: 90_536_183.63 },
        { asset_class: 'fund_share', count: 1, value: 23_116_074 },
      ]),
    ]

    const completed = compositionHistoryWithCurrentReport({
      history,
      report: report({
        reference_date: '2026-07-01',
        cri: 617_677_400,
        fii_holdings: 88_106_896,
        fixed_income_funds: 64_961_860,
      }),
    })

    expect(completed).toHaveLength(2)
    expect(completed.at(-1)?.reference_date).toBe('2026-06-30')
    expect(completed.at(-1)?.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ asset_class: 'cri', value: 617_677_400 }),
        expect.objectContaining({ asset_class: 'fii', value: 88_106_896 }),
        expect.objectContaining({ asset_class: 'fund_share', value: 64_961_860 }),
      ]),
    )
    expect(completed.at(-1)?.allocations).not.toContainEqual(
      expect.objectContaining({ asset_class: 'real_estate' }),
    )
    expect(history.at(-1)?.allocations).toHaveLength(2)
  })

  it('does not let an older monthly report rewrite a newer quarter', () => {
    const history = [
      compositionPoint('2026-06-30', [
        { asset_class: 'cri', count: 98, value: 683_324_870.21 },
      ]),
    ]

    expect(
      compositionHistoryWithCurrentReport({
        history,
        report: report({ reference_date: '2026-05-01', cri: 1 }),
      }),
    ).toBe(history)
  })
})
