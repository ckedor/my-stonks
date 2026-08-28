/* Onde pôr o dinheiro de um aporte.
 *
 * Rebalancear redistribuindo a carteira inteira é uma conta: alvo menos
 * atual, e o que sobrar vende. Aportar é outra — quem aporta está comprando,
 * e uma sugestão de venda não responde à pergunta que a pessoa fez. Por isso
 * a distribuição aqui é **só compra**: nenhuma posição diminui, e chegar na
 * porcentagem exata não é requisito. O que se quer é que cada aporte deixe a
 * carteira mais perto dos alvos do que ela estava.
 *
 * A regra é a do nível de água. Imagine cada categoria como um tanque cuja
 * altura é o valor que ela teria numa carteira de tamanho `L`:
 *
 *     valor final ᵢ = max(valor atual ᵢ, peso alvo ᵢ × L)
 *
 * O aporte sobe `L` até a soma dos tanques bater com o patrimônio mais o
 * aporte. Quem já está acima da própria linha d'água não recebe nada, e o
 * dinheiro se concentra em quem está mais atrasado — que é o que faz a
 * carteira convergir aporte após aporte.
 *
 * `L` sai exato, sem busca binária. A categoria `i` só começa a receber
 * quando `L` passa de `rᵢ = vᵢ / wᵢ`, então os `rᵢ` ordenados são os pontos
 * de virada: fixado o conjunto que recebe, `L` é a solução de uma equação
 * linear, e a resposta é o primeiro `L` que cai dentro da própria faixa. */

/** Uma posição que disputa o aporte: quanto ela vale e quanto deveria pesar. */
export interface ContributionSlice {
  /** Valor atual, na moeda da tela. */
  value: number
  /** Peso alvo, em pontos percentuais. Nulo quando não há alvo definido —
   *  sem alvo não há atraso a corrigir, e a fatia fica fora do rateio. */
  targetPct: number | null
}

/** Quanto comprar de cada fatia, na mesma ordem em que elas entraram. */
export type ContributionPlan = number[]

/* Abaixo disto o valor é ruído de arredondamento, não dinheiro. */
const EPSILON = 1e-9

/**
 * Distribui `contribution` entre `slices` comprando só o que está atrasado.
 *
 * Devolve um vetor na ordem da entrada. Toda entrada é `>= 0`, e a soma é
 * exatamente `contribution` — o que sobra da distribuição por peso volta
 * para a fatia mais atrasada em vez de sumir no arredondamento.
 *
 * Aporte nulo, negativo ou sem nenhuma fatia com alvo devolve tudo zero: não
 * há o que sugerir, e zero é a resposta honesta.
 */
export function planContribution(
  slices: ContributionSlice[],
  contribution: number,
): ContributionPlan {
  const plan = slices.map(() => 0)

  if (!(contribution > EPSILON)) return plan

  /* Só quem tem alvo disputa. Os pesos são normalizados sobre esse conjunto:
     uma soma de alvos que não fecha 100 — porque uma categoria ficou sem
     alvo, ou porque o usuário está no meio da edição — distorceria o rateio
     em vez de simplesmente distribuir o que há entre quem participa. */
  const eligible = slices
    .map((slice, index) => ({ index, value: slice.value, targetPct: slice.targetPct }))
    .filter((slice): slice is { index: number; value: number; targetPct: number } =>
      slice.targetPct != null && slice.targetPct > 0,
    )

  const totalTarget = eligible.reduce((sum, slice) => sum + slice.targetPct, 0)
  if (eligible.length === 0 || totalTarget <= 0) return plan

  const weighted = eligible.map((slice) => ({
    index: slice.index,
    value: slice.value,
    weight: slice.targetPct / totalTarget,
    /* O tamanho de carteira a partir do qual esta fatia deixa de estar
       adiantada e passa a receber. */
    threshold: slice.value / (slice.targetPct / totalTarget),
  }))

  /* Varre os pontos de virada em ordem. Com o conjunto ativo `S` — as `k`
     primeiras, as mais atrasadas —, a soma dos tanques é
     `Σ_S wᵢ·L + Σ_resto vᵢ`, e igualar ao patrimônio mais o aporte dá
     `L = (C + Σ_S vᵢ) / Σ_S wᵢ`. Vale a primeira faixa em que esse `L`
     realmente ativa `S` e mais ninguém. */
  const ordered = [...weighted].sort((a, b) => a.threshold - b.threshold)

  let activeValue = 0
  let activeWeight = 0
  let level = 0

  for (let k = 0; k < ordered.length; k++) {
    activeValue += ordered[k].value
    activeWeight += ordered[k].weight

    const candidate = (contribution + activeValue) / activeWeight
    const next = ordered[k + 1]

    /* Dentro da faixa: já passou do limiar de quem está ativo e ainda não
       alcançou o próximo. A última faixa não tem teto. */
    if (candidate >= ordered[k].threshold && (!next || candidate <= next.threshold)) {
      level = candidate
      break
    }
  }

  /* Se nenhuma faixa fechou — só acontece com aritmética de ponto flutuante
     em limiares empatados —, a última é a resposta: com todas ativas a
     equação sempre tem solução. */
  if (level === 0) {
    level = (contribution + activeValue) / activeWeight
  }

  for (const slice of weighted) {
    const target = slice.weight * level
    plan[slice.index] = Math.max(0, target - slice.value)
  }

  /* A soma tem de ser o aporte. A diferença que sobra é de arredondamento, e
     ela vai para quem recebeu mais — a fatia mais atrasada — porque é onde
     um centavo a mais ou a menos não muda a leitura. */
  const distributed = plan.reduce((sum, amount) => sum + amount, 0)
  const leftover = contribution - distributed

  if (Math.abs(leftover) > EPSILON) {
    let largest = -1
    for (let i = 0; i < plan.length; i++) {
      if (plan[i] > 0 && (largest === -1 || plan[i] > plan[largest])) largest = i
    }
    if (largest !== -1) plan[largest] = Math.max(0, plan[largest] + leftover)
  }

  return plan
}
