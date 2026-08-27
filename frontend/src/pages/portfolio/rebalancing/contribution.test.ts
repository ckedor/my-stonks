import { describe, expect, it } from 'vitest'
import { planContribution } from './contribution'

/* O que a regra promete, um caso por promessa. Aqui é onde o comportamento
 * fica definido: a tela só desenha o que estas contas devolvem. */

const soma = (plan: number[]) => plan.reduce((total, amount) => total + amount, 0)

describe('planContribution', () => {
  it('nunca sugere venda: a categoria acima do alvo recebe zero', () => {
    /* Cripto vale 20,46% da carteira e quer 10% — está adiantada. */
    const plan = planContribution(
      [
        { value: 115_995.96, targetPct: 60 },
        { value: 42_113.67, targetPct: 10 },
        { value: 27_692.68, targetPct: 5 },
        { value: 13_858.6, targetPct: 15 },
        { value: 5_639.54, targetPct: 5 },
        { value: 515.61, targetPct: 5 },
      ],
      10_000,
    )

    expect(plan.every((amount) => amount >= 0)).toBe(true)
    expect(plan[1]).toBe(0) // Cripto
    expect(plan[2]).toBe(0) // Renda Fixa
  })

  it('ordena pelo atraso relativo, e não pela diferença em pontos', () => {
    /* O caso que surpreende, e é o comportamento certo: EUA está 3,64 pontos
       abaixo do alvo e não recebe nada, enquanto Ouro — 0,25% de uma carteira
       que o quer em 5% — leva mais da metade do aporte. Vinte vezes atrasado
       pesa mais do que seis por cento atrasado, e é assim que a carteira
       converge: cada aporte vai para o pior buraco, não para todos eles. */
    const plan = planContribution(
      [
        { value: 115_995.96, targetPct: 60 }, // EUA
        { value: 42_113.67, targetPct: 10 }, // Cripto
        { value: 27_692.68, targetPct: 5 }, // Renda Fixa
        { value: 13_858.6, targetPct: 15 }, // FIIs
        { value: 5_639.54, targetPct: 5 }, // Bolsa BR
        { value: 515.61, targetPct: 5 }, // Ouro
      ],
      10_000,
    )

    expect(plan[0]).toBe(0) // EUA: atrás do alvo, mas menos que os três últimos
    expect(plan[1]).toBe(0) // Cripto: adiantada
    expect(plan[2]).toBe(0) // Renda Fixa: adiantada
    expect(plan[5]).toBeGreaterThan(plan[3]) // Ouro leva mais que FIIs
    expect(plan[3]).toBeGreaterThan(plan[4]) // FIIs leva mais que Bolsa BR
    expect(soma(plan)).toBeCloseTo(10_000, 6)
  })

  it('concentra o aporte pequeno em quem está mais atrasado', () => {
    /* Ouro tem 0,25% e quer 5%: é o mais atrasado da carteira, e um aporte
       que não dá para arrumar ninguém vai inteiro para ele. */
    const plan = planContribution(
      [
        { value: 115_995.96, targetPct: 60 },
        { value: 13_858.6, targetPct: 15 },
        { value: 515.61, targetPct: 5 },
      ],
      1_000,
    )

    expect(plan[2]).toBeCloseTo(1_000, 6)
    expect(plan[0]).toBe(0)
    expect(plan[1]).toBe(0)
  })

  it('a soma do comprado é exatamente o aporte', () => {
    const contribution = 37_431.19
    const plan = planContribution(
      [
        { value: 115_995.96, targetPct: 60 },
        { value: 42_113.67, targetPct: 10 },
        { value: 27_692.68, targetPct: 5 },
        { value: 13_858.6, targetPct: 15 },
        { value: 5_639.54, targetPct: 5 },
        { value: 515.61, targetPct: 5 },
      ],
      contribution,
    )

    expect(soma(plan)).toBeCloseTo(contribution, 6)
  })

  it('o aporte grande o bastante põe todo mundo no alvo', () => {
    /* Com dinheiro que sobra, ninguém fica preso acima da linha d'água e a
       carteira final é exatamente a alocação alvo. */
    const values = [10_000, 1_000, 1_000]
    const plan = planContribution(
      [
        { value: values[0], targetPct: 40 },
        { value: values[1], targetPct: 30 },
        { value: values[2], targetPct: 30 },
      ],
      1_000_000,
    )

    const total = values.reduce((a, b) => a + b, 0) + 1_000_000
    expect(values[0] + plan[0]).toBeCloseTo(total * 0.4, 4)
    expect(values[1] + plan[1]).toBeCloseTo(total * 0.3, 4)
    expect(values[2] + plan[2]).toBeCloseTo(total * 0.3, 4)
  })

  it('ignora a fatia sem alvo e distribui entre quem tem', () => {
    const plan = planContribution(
      [
        { value: 1_000, targetPct: null },
        { value: 1_000, targetPct: 50 },
        { value: 3_000, targetPct: 50 },
      ],
      1_000,
    )

    expect(plan[0]).toBe(0)
    expect(plan[1]).toBeCloseTo(1_000, 6)
    expect(plan[2]).toBe(0)
  })

  it('normaliza os pesos quando a soma dos alvos não fecha 100', () => {
    /* Meio da edição: dois alvos de 30 somam 60. O aporte se divide entre os
       dois assim mesmo, em vez de sumir 40% dele. */
    const plan = planContribution(
      [
        { value: 1_000, targetPct: 30 },
        { value: 1_000, targetPct: 30 },
      ],
      500,
    )

    expect(soma(plan)).toBeCloseTo(500, 6)
    expect(plan[0]).toBeCloseTo(250, 6)
    expect(plan[1]).toBeCloseTo(250, 6)
  })

  it('devolve tudo zero sem aporte, e sem alvo nenhum', () => {
    const fatias = [
      { value: 1_000, targetPct: 50 },
      { value: 1_000, targetPct: 50 },
    ]

    expect(planContribution(fatias, 0)).toEqual([0, 0])
    expect(planContribution(fatias, -100)).toEqual([0, 0])
    expect(
      planContribution(
        [
          { value: 1_000, targetPct: null },
          { value: 1_000, targetPct: null },
        ],
        1_000,
      ),
    ).toEqual([0, 0])
  })

  it('parte de uma carteira zerada rateando pelo alvo', () => {
    const plan = planContribution(
      [
        { value: 0, targetPct: 70 },
        { value: 0, targetPct: 30 },
      ],
      1_000,
    )

    expect(plan[0]).toBeCloseTo(700, 6)
    expect(plan[1]).toBeCloseTo(300, 6)
  })

  it('serve também aos ativos dentro de uma categoria', () => {
    /* A mesma função vale um nível abaixo: o valor comprado da categoria é o
       aporte, e os pesos são os alvos dentro dela. */
    const plan = planContribution(
      [
        { value: 13_800, targetPct: 70 },
        { value: 4_877, targetPct: 30 },
      ],
      2_000,
    )

    expect(soma(plan)).toBeCloseTo(2_000, 6)
    expect(plan.every((amount) => amount >= 0)).toBe(true)
  })
})
