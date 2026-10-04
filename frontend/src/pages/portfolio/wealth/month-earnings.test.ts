import { describe, expect, it } from 'vitest'

import { monthEarningsAt, monthlyEarnings } from './month-earnings'

describe('monthEarningsAt', () => {
  it('começa o mês em zero', () => {
    const earned = monthEarningsAt(100_000, 0.2, new Date(2026, 9, 1, 0, 0, 0))

    expect(earned).toBe(0)
  })

  it('não começa zerado no meio do mês', () => {
    const earned = monthEarningsAt(100_000, 0.2, new Date(2026, 9, 16))

    // 15 dias a 20% a.a. sobre 100 mil: ~ R$ 750.
    expect(earned).toBeGreaterThan(740)
    expect(earned).toBeLessThan(760)
  })

  it('zera na virada do mês', () => {
    const lastSecond = monthEarningsAt(100_000, 0.2, new Date(2026, 9, 31, 23, 59, 59))
    const firstSecond = monthEarningsAt(100_000, 0.2, new Date(2026, 10, 1, 0, 0, 1))

    expect(lastSecond).toBeGreaterThan(1_000)
    expect(firstSecond).toBeLessThan(0.01)
  })

  it('desce quando o CAGR é negativo', () => {
    const earned = monthEarningsAt(100_000, -0.1, new Date(2026, 9, 16))

    expect(earned).toBeLessThan(0)
  })
})

describe('monthlyEarnings', () => {
  it('doze meses compostos fecham o CAGR do ano', () => {
    const monthly = monthlyEarnings(100_000, 0.2)

    expect(monthly).toBeGreaterThan(1_500)
    expect(monthly).toBeLessThan(1_550)
    expect(100_000 * Math.pow(1 + monthly / 100_000, 12)).toBeCloseTo(120_000, 4)
  })
})
