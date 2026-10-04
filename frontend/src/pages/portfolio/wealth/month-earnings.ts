/* Quanto a carteira "rendeu" no mês até agora — uma brincadeira, não uma
 * apuração. Supõe que o patrimônio de hoje estava aplicado desde o dia 1º,
 * às 00:00, crescendo continuamente no CAGR histórico. Não olha cotação,
 * aporte nem provento: o número sobe sozinho, a cada instante, e volta a
 * zero na virada do mês. */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

/** `cagr` é a fração anual (0.12 para 12%). O mês é o do relógio local.
 *  Devolve o acumulado desde o início do mês. */
export function monthEarningsAt(patrimony: number, cagr: number, now: Date): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const years = (now.getTime() - monthStart.getTime()) / MS_PER_YEAR
  const rate = Math.log1p(cagr)

  return patrimony * Math.expm1(rate * years)
}

/** Quanto o patrimônio rende num mês inteiro ao CAGR: a taxa anual composta
 *  em doze partes iguais, e não um doze avos dela. */
export function monthlyEarnings(patrimony: number, cagr: number): number {
  return patrimony * (Math.pow(1 + cagr, 1 / 12) - 1)
}
