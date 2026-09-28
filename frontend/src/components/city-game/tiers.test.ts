import { describe, expect, it } from 'vitest'

import { CITY_TIERS, cityTierStanding, projectTierArrival } from './tiers'

describe('patente da cidade', () => {
  it('começa em Mendigo e termina em Rei do Mundo', () => {
    expect(CITY_TIERS[0]).toMatchObject({ rank: 1, name: 'Mendigo', thresholdUsd: 0 })
    expect(CITY_TIERS.at(-1)).toMatchObject({ name: 'Rei do Mundo', thresholdUsd: 1_000_000 })
  })

  it('sobe a cada US$ 5 mil no começo, e o passo cresce depois', () => {
    expect(CITY_TIERS[1].thresholdUsd).toBe(5_000)
    expect(CITY_TIERS[2].thresholdUsd).toBe(10_000)
    const steps = CITY_TIERS.slice(1).map((tier, i) => tier.thresholdUsd - CITY_TIERS[i].thresholdUsd)
    expect(steps.every((step, i) => i === 0 || step >= steps[i - 1])).toBe(true)
    expect(steps.at(-1)!).toBeGreaterThan(5_000)
  })

  it('mede o trecho entre o degrau de hoje e o seguinte', () => {
    const standing = cityTierStanding(7_500)
    expect(standing.current.name).toBe('Catador de latinhas')
    expect(standing.next!.thresholdUsd).toBe(10_000)
    expect(standing.remainingUsd).toBe(2_500)
    expect(standing.progress).toBeCloseTo(0.5)
  })

  it('no topo, a barra está cheia e não há próximo', () => {
    const standing = cityTierStanding(50_000_000)
    expect(standing.current.name).toBe('Rei do Mundo')
    expect(standing.next).toBeNull()
    expect(standing.progress).toBe(1)
  })
})

describe('previsão da próxima patente', () => {
  const base = { patrimonyUsd: 10_000, targetUsd: 12_000, today: '2026-09-28' }

  it('soma o aporte médio todo mês', () => {
    expect(projectTierArrival({ ...base, annualRate: 0, monthlyContributionUsd: 500 }))
      .toEqual({ months: 4, targetDate: '2027-01-01' })
  })

  it('faz o patrimônio render no CAGR', () => {
    // 21% ao ano, sem aporte: 10 mil passam de 12 mil em um ano, e não antes.
    expect(projectTierArrival({ ...base, annualRate: 0.21, monthlyContributionUsd: 0 })?.months).toBe(12)
  })

  it('sem ritmo que chegue lá, não dá data', () => {
    expect(projectTierArrival({ ...base, annualRate: 0, monthlyContributionUsd: 0 })).toBeNull()
  })
})
