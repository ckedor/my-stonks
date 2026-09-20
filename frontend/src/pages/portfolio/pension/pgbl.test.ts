import { describe, expect, it } from 'vitest'
import { annualTax, monthlyInss, planPgbl, SIMPLIFIED_DISCOUNT_CAP } from './pgbl'

/* O que a regra promete, um caso por promessa. A tela só desenha o que estas
 * contas devolvem. */

describe('monthlyInss', () => {
  it('cobra faixa por faixa, e não a alíquota do topo sobre tudo', () => {
    // 1.518 × 7,5% + (2.500 − 1.518) × 9%
    expect(monthlyInss(2_500)).toBeCloseTo(113.85 + 88.38, 2)
  })

  it('para de crescer no teto', () => {
    const teto = monthlyInss(8_157.41)
    expect(teto).toBeCloseTo(951.62, 1)
    expect(monthlyInss(30_000)).toBeCloseTo(teto, 6)
  })
})

describe('planPgbl', () => {
  it('o teto do aporte é 12% do salário mais o bônus, antes do INSS', () => {
    const plan = planPgbl({ monthlySalary: 15_000, annualBonus: 30_000 })

    expect(plan.grossIncome).toBe(210_000)
    expect(plan.contributionLimit).toBeCloseTo(25_200, 2)
    expect(plan.monthlyContribution).toBeCloseTo(2_100, 2)
  })

  it('a economia por faixa soma exatamente a economia na completa', () => {
    const plan = planPgbl({ monthlySalary: 9_000, annualBonus: 12_000 })
    const somado = plan.tranches.reduce((total, tranche) => total + tranche.saving, 0)

    expect(somado).toBeCloseTo(plan.taxComplete - plan.taxWithPgbl, 6)
  })

  it('o abatimento desce a tabela: nem todo o aporte economiza a 27,5%', () => {
    /* Base logo acima do começo da última faixa — o aporte atravessa para
       baixo e parte dele economiza a 22,5%. */
    const plan = planPgbl({ monthlySalary: 6_000, annualBonus: 0 })
    const aliquotas = plan.tranches.map((tranche) => tranche.rate)

    expect(aliquotas).toContain(0.275)
    expect(aliquotas).toContain(0.225)
    expect(plan.refundRate).toBeLessThan(0.275)
  })

  it('sem imposto a reduzir, não há restituição', () => {
    const plan = planPgbl({ monthlySalary: 2_000, annualBonus: 0 })

    expect(plan.taxComplete).toBe(0)
    expect(plan.refund).toBe(0)
    expect(plan.refundRate).toBe(0)
  })

  it('mede contra a simplificada quando é ela que vence sem PGBL', () => {
    /* Salário em que 20% da renda ainda batem o INSS: a completa sem PGBL
       paga mais imposto que a simplificada, então é a simplificada que
       define o que o aporte de fato acrescenta. */
    const plan = planPgbl({ monthlySalary: 5_500, annualBonus: 0 })

    expect(plan.simplifiedWinsWithoutPgbl).toBe(true)
    expect(plan.refund).toBeCloseTo(plan.taxSimplified - plan.taxWithPgbl, 6)
    expect(plan.refund).toBeLessThan(plan.taxComplete - plan.taxWithPgbl)
  })

  it('renda alta: o INSS sozinho não bate o desconto simplificado', () => {
    /* O INSS no teto são R$ 11.419 por ano, abaixo dos R$ 16.754,34 do
       desconto simplificado: sem PGBL, a simplificada vence em qualquer
       salário. É contra ela que a restituição é medida — e é por isso que
       ela sai abaixo de 27,5% do aporte mesmo com a renda toda na última
       faixa. */
    const plan = planPgbl({ monthlySalary: 25_000, annualBonus: 0 })

    expect(plan.simplifiedWinsWithoutPgbl).toBe(true)
    expect(plan.taxSimplified).toBeCloseTo(annualTax(300_000 - SIMPLIFIED_DISCOUNT_CAP), 6)
    expect(plan.refund).toBeCloseTo(plan.taxSimplified - plan.taxWithPgbl, 6)
    expect(plan.refundRate).toBeLessThan(0.275)
    /* Com o aporte, a completa passa a valer a pena: é o que a tela avisa. */
    expect(plan.taxWithPgbl).toBeLessThan(plan.taxSimplified)
  })

  it('renda zerada devolve um plano zerado em vez de NaN', () => {
    const plan = planPgbl({ monthlySalary: 0, annualBonus: 0 })

    expect(plan.contributionLimit).toBe(0)
    expect(plan.refund).toBe(0)
    expect(plan.refundRate).toBe(0)
    expect(plan.tranches).toEqual([])
  })
})
