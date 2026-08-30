import type {
  StockCashDividend,
  StockFundamentals,
  StockPriceRange,
  StockStatistics,
} from '@/api/market'
import { describe, expect, it } from 'vitest'
import {
  dividendReading,
  isInterestOnEquity,
  priceRangeReading,
  qualityReading,
  recentPayments,
  valuationReading,
} from './readings'

const TODAY = new Date('2026-08-30T12:00:00Z')

const range = (overrides: Partial<StockPriceRange> = {}): StockPriceRange => ({
  price: 43.55,
  previous_close: 43.53,
  day_change: 0.0199,
  day_low: 42.62,
  day_high: 43.6,
  fifty_two_week_low: 29.31,
  fifty_two_week_high: 50.69,
  market_cap: 590393380664,
  volume: 46135600,
  as_of: '2026-08-30',
  ...overrides,
})

const statistics = (overrides: Partial<StockStatistics> = {}): StockStatistics =>
  ({
    trailing_pe: 4.66,
    price_to_book: 1.17,
    dividend_yield: 0.08,
    ...overrides,
  }) as StockStatistics

const fundamentals = (overrides: Partial<StockFundamentals> = {}): StockFundamentals =>
  ({
    return_on_equity: 0.2781,
    profit_margin: 0.2439,
    ...overrides,
  }) as StockFundamentals

const payment = (overrides: Partial<StockCashDividend> = {}): StockCashDividend => ({
  payment_date: '2026-05-20',
  last_date_prior: '2026-04-25',
  approved_on: '2026-04-10',
  value_per_share: 0.32,
  label: 'DIVIDENDO',
  related_to: '',
  ...overrides,
})

describe('priceRangeReading', () => {
  it('situa o preço entre o piso e o teto do ano', () => {
    const reading = priceRangeReading(range())

    expect(reading?.position).toBeCloseTo((43.55 - 29.31) / (50.69 - 29.31), 6)
    expect(reading?.low).toBe(29.31)
    expect(reading?.high).toBe(50.69)
  })

  it('não devolve leitura quando a faixa é degenerada', () => {
    // Teto igual ao piso é divisão por zero disfarçada, e um papel que passou o
    // ano parado não tem posição dentro de uma faixa que não existe.
    expect(priceRangeReading(range({ fifty_two_week_low: 40, fifty_two_week_high: 40 }))).toBeNull()
  })

  it('não devolve leitura sem algum dos três números', () => {
    expect(priceRangeReading(range({ price: null }))).toBeNull()
    expect(priceRangeReading(range({ fifty_two_week_low: null }))).toBeNull()
    expect(priceRangeReading(null)).toBeNull()
  })

  it('prende a posição aos extremos quando o preço sai da faixa', () => {
    // A máxima nova ainda não entrou no `fiftyTwoWeekHigh` publicado, e sem o
    // limite a barra desenharia fora de si mesma.
    expect(priceRangeReading(range({ price: 55 }))?.position).toBe(1)
    expect(priceRangeReading(range({ price: 20 }))?.position).toBe(0)
  })
})

describe('valuationReading', () => {
  it('lê os múltiplos como publicados', () => {
    const reading = valuationReading(statistics())

    expect(reading?.priceToEarnings).toBe(4.66)
    expect(reading?.priceToBook).toBe(1.17)
  })

  it('não recalcula o P/L a partir de preço e lucro por ação', () => {
    // Sem o múltiplo publicado não há leitura, mesmo com preço e LPA presentes:
    // dividir um pelo outro produziria um terceiro número, nosso, competindo
    // com o que o mercado cota.
    const reading = valuationReading(
      statistics({ trailing_pe: null, earnings_per_share: 10.35, price_to_book: null })
    )

    expect(reading).toBeNull()
  })

  it('devolve o múltiplo que veio quando só um dos dois foi publicado', () => {
    expect(valuationReading(statistics({ trailing_pe: null }))).toEqual({
      priceToEarnings: null,
      priceToBook: 1.17,
    })
  })
})

describe('qualityReading', () => {
  it('lê a margem dos fundamentos, que é a fonte única dela', () => {
    // A margem é publicada por duas rotas. Lida das duas, os dois cards podiam
    // divergir num arredondamento — que é a diferença que ninguém percebe e
    // todo mundo desconfia.
    const reading = qualityReading(fundamentals({ profit_margin: 0.2439 }))

    expect(reading?.profitMargin).toBe(0.2439)
    expect(reading?.returnOnEquity).toBe(0.2781)
  })

  it('não devolve leitura quando nenhuma das duas medidas veio', () => {
    expect(qualityReading(fundamentals({ return_on_equity: null, profit_margin: null }))).toBeNull()
    expect(qualityReading(null)).toBeNull()
  })
})

describe('dividendReading', () => {
  it('separa o que já foi pago do que só foi anunciado', () => {
    const reading = dividendReading(
      [payment({ payment_date: '2026-05-20' }), payment({ payment_date: '2026-12-21' })],
      statistics(),
      TODAY
    )

    expect(reading?.last?.payment_date).toBe('2026-05-20')
    expect(reading?.upcoming?.payment_date).toBe('2026-12-21')
  })

  it('não trata um anúncio futuro como último pagamento', () => {
    // O dinheiro ainda não entrou, e chamar o anúncio de "último rendimento"
    // diria que entrou.
    const reading = dividendReading([payment({ payment_date: '2026-12-21' })], statistics(), TODAY)

    expect(reading?.last).toBeNull()
    expect(reading?.upcoming?.payment_date).toBe('2026-12-21')
  })

  it('carrega o yield publicado mesmo sem nenhum pagamento na lista', () => {
    const reading = dividendReading([], statistics({ dividend_yield: 0.08 }), TODAY)

    expect(reading?.yield12m).toBe(0.08)
    expect(reading?.last).toBeNull()
  })

  it('não devolve leitura quando não há nem yield nem pagamento', () => {
    expect(dividendReading([], statistics({ dividend_yield: null }), TODAY)).toBeNull()
  })
})

describe('isInterestOnEquity', () => {
  it('separa JCP de dividendo pelo rótulo, e nunca pelo valor', () => {
    // JCP tem 15% retidos na fonte e dividendo não tem. Não há nada no número
    // que diga qual dos dois é.
    expect(isInterestOnEquity(payment({ label: 'JCP' }))).toBe(true)
    expect(isInterestOnEquity(payment({ label: 'jcp' }))).toBe(true)
    expect(isInterestOnEquity(payment({ label: 'DIVIDENDO' }))).toBe(false)
    expect(isInterestOnEquity(payment({ label: null }))).toBe(false)
  })
})

describe('recentPayments', () => {
  it('devolve os últimos que já ocorreram, do mais antigo para o mais recente', () => {
    const payments = [
      payment({ payment_date: '2026-01-20' }),
      payment({ payment_date: '2026-03-20' }),
      payment({ payment_date: '2026-05-20' }),
      // Um anúncio no meio da série desenharia futuro como se fosse histórico.
      payment({ payment_date: '2026-12-21' }),
    ]

    expect(recentPayments(payments, 2, TODAY).map((item) => item.payment_date)).toEqual([
      '2026-03-20',
      '2026-05-20',
    ])
  })

  it('deixa de fora um pagamento sem valor publicado', () => {
    const payments = [payment({ value_per_share: null }), payment({ payment_date: '2026-05-20' })]

    expect(recentPayments(payments, 6, TODAY)).toHaveLength(1)
  })
})
