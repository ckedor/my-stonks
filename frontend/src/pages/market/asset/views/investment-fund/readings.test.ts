import type {
  InvestmentFundDividend,
  InvestmentFundHolding,
  InvestmentFundIndicators,
  InvestmentFundNavPoint,
} from '@/api/market'
import { describe, expect, it } from 'vitest'

import { formatFiledPercent, formatPercent } from '../format'
import { holdingsByBucket, incomeTrend, navReading, navTrend, portfolioSlices } from './readings'

const indicators = (
  overrides: Partial<InvestmentFundIndicators> = {},
): InvestmentFundIndicators => ({
  as_of_date: '2026-06-18',
  price: 96.99,
  nav_per_share: 99.19945,
  price_to_nav: 0.9777272,
  equity: 2040699000,
  total_assets: 2041704100,
  shareholders: 92710,
  daily_applications: 0,
  daily_redemptions: 0,
  shares_outstanding: null,
  monthly_return: null,
  patrimonial_monthly_return: null,
  dividend_yield_monthly: null,
  ...overrides,
})

const payment = (
  payment_date: string,
  value_per_share: number,
  event_type: string | null = 'RENDIMENTO',
): InvestmentFundDividend => ({
  payment_date,
  ex_date: null,
  declared_date: null,
  value_per_share,
  event_type,
})

const filing = (
  date: string,
  nav_per_share: number | null,
  class_or_series: string | null = null,
): InvestmentFundNavPoint => ({
  date,
  class_or_series,
  nav_per_share,
  equity: 2040699000,
  total_assets: 2041704100,
  shareholders: 92710,
  daily_applications: 0,
  daily_redemptions: 0,
  monthly_return: null,
})

const holding = (
  bucket: string,
  market_value: number | null,
  asset_name: string | null = 'Um ativo',
): InvestmentFundHolding => ({
  bucket,
  asset_type: null,
  asset_name,
  issuer_name: null,
  issuer_cnpj: null,
  isin: null,
  selic_code: null,
  quantity: null,
  market_value,
  cost_value: null,
  maturity_date: null,
  confidential: null,
  details: {},
})

describe('navReading', () => {
  it('turns the published P/VP into how far the share is from the fund’s own valuation', () => {
    const reading = navReading(indicators())

    expect(reading?.direction).toBe('below')
    expect(reading?.deviation).toBeCloseTo(-0.0222728, 7)
    expect(reading?.asOfDate).toBe('2026-06-18')
  })

  it('reads a multiple above one as a premium', () => {
    expect(navReading(indicators({ price_to_nav: 1.031 }))?.direction).toBe('above')
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
      payment('2026-06-13', 0.5),
      payment('2026-04-14', 0.44),
      payment('2026-05-14', 0.48),
    ])

    expect(trend?.last.payment_date).toBe('2026-06-13')
    expect(trend?.previous?.payment_date).toBe('2026-05-14')
    expect(formatPercent(trend?.change)).toBe('4,17%')
  })

  it('leaves an amortization of capital out of the comparison', () => {
    // Amortização devolve principal. Comparar a renda do período contra ela
    // mediria a devolução do principal, não o que o fundo paga.
    const trend = incomeTrend([
      payment('2026-05-14', 0.48),
      payment('2026-06-13', 12.5, 'AMORTIZACAO'),
    ])

    expect(trend?.last.payment_date).toBe('2026-05-14')
    expect(trend?.change).toBeNull()
  })

  it('reads an unlabelled payment as income', () => {
    // É o que essas rotas majoritariamente carregam; descartá-los esvaziaria o
    // histórico dos fundos cujo rótulo o provedor não preenche.
    expect(incomeTrend([payment('2026-05-14', 0.48, null)])?.last.value_per_share).toBe(0.48)
  })

  it('does not invent a trend for a fund with a single payment', () => {
    const trend = incomeTrend([payment('2026-05-14', 0.48)])

    expect(trend?.previous).toBeNull()
    expect(trend?.change).toBeNull()
  })

  it('says nothing when the fund has never paid', () => {
    expect(incomeTrend([])).toBeNull()
  })
})

describe('navTrend', () => {
  it('measures the share value against the previous filing', () => {
    const trend = navTrend([filing('2026-06-17', 99.1), filing('2026-06-18', 99.19945)])

    expect(trend?.navPerShare).toBe(99.19945)
    expect(trend?.date).toBe('2026-06-18')
    expect(trend?.previousDate).toBe('2026-06-17')
    expect(trend?.change).toBeCloseTo(0.0010035, 6)
  })

  it('compares a class against itself and never against another class', () => {
    // Uma sênior a 120 e uma subordinada a 80 são cotas diferentes do mesmo
    // fundo. Medir uma contra a outra daria a diferença entre elas, com cara
    // de variação.
    const trend = navTrend([
      filing('2026-06-17', 118.0, 'Sênior'),
      filing('2026-06-17', 79.0, 'Subordinada'),
      filing('2026-06-18', 80.0, 'Subordinada'),
      filing('2026-06-18', 120.0, 'Sênior'),
    ])

    expect(trend?.classOrSeries).toBe('Sênior')
    expect(trend?.navPerShare).toBe(120.0)
    expect(trend?.change).toBeCloseTo(120 / 118 - 1, 9)
  })

  it('does not invent a variation for a single filing', () => {
    const trend = navTrend([filing('2026-06-18', 99.19945)])

    expect(trend?.change).toBeNull()
    expect(trend?.previousDate).toBeNull()
  })

  it('ignores a filing that carries no share value', () => {
    // Lê-la como zero desenharia uma queda a zero que nunca aconteceu.
    const trend = navTrend([filing('2026-06-17', 99.1), filing('2026-06-18', null)])

    expect(trend?.date).toBe('2026-06-17')
    expect(trend?.change).toBeNull()
  })

  it('says nothing when nothing was filed', () => {
    expect(navTrend([])).toBeNull()
  })
})

describe('portfolioSlices', () => {
  it('adds up what the fund owns, one slice per group, in reading order', () => {
    const slices = portfolioSlices([
      holding('fund_holdings', 2053162240),
      holding('public_bonds', 6403800),
      holding('public_bonds', 1000000),
    ])

    expect(slices).toEqual([
      { label: 'Títulos públicos', value: 7403800 },
      { label: 'Cotas de fundos', value: 2053162240 },
    ])
  })

  it('leaves claims and obligations out of what the fund owns', () => {
    // Uma fatia de "a pagar" afirmaria que o fundo possui a própria dívida.
    const slices = portfolioSlices([
      holding('public_bonds', 6403800),
      holding('receivables', 12371910),
      holding('payables', 11913311),
    ])

    expect(slices).toEqual([{ label: 'Títulos públicos', value: 6403800 }])
  })

  it('drops a group worth nothing rather than drawing a sliver of a label', () => {
    const slices = portfolioSlices([
      holding('public_bonds', 6403800),
      holding('credit_assets', 0),
      holding('listed_securities', null),
    ])

    expect(slices).toEqual([{ label: 'Títulos públicos', value: 6403800 }])
  })
})

describe('holdingsByBucket', () => {
  it('keeps only the groups this fund actually filed, in reading order', () => {
    // Uma tabela "Cotas de fundos" vazia faria o leitor procurar o que não
    // existe.
    const groups = holdingsByBucket([
      holding('payables', 11913311, 'Rendimentos a pagar'),
      holding('public_bonds', 6403800, 'NTN-B'),
    ])

    expect(groups.map((group) => group.label)).toEqual(['Títulos públicos', 'A pagar'])
    expect(groups[0].holdings).toHaveLength(1)
  })
})

describe('formatFiledPercent', () => {
  it('writes a percentage the regulator already scaled, without scaling it again', () => {
    // O informe publica participação em pontos de 0 a 100; multiplicar por cem
    // escreveria "10000%" onde há 100%.
    expect(formatFiledPercent(100)).toBe('100,00%')
    expect(formatFiledPercent(0)).toBe('0,00%')
    expect(formatFiledPercent(null)).toBe('—')
    // E uma razão continua sendo escalada pelo formatador das razões.
    expect(formatPercent(0.0142)).toBe('1,42%')
  })
})
