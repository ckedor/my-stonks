/* Os bônus da cidade: o dinheiro do jogo que não é o patrimônio.

   O jogo quer premiar o que se faz com a carteira, não só o tamanho dela.
   Três coisas rendem bônus, e as três saem de dado que o servidor já tem —
   nada aqui é guardado, então o bônus é recalculado a cada visita:

   - dividendo recebido conta em dobro: ele entra no saldo e rende outro
     tanto de bônus;
   - aporte rende um quarto do que entrou, para que aportar valha a pena
     também no jogo;
   - cada categoria que vence o próprio benchmark num mês fechado rende um
     prêmio fixo, qualquer que seja o tamanho dela. */

import type { CategoryReturnEntry, Dividend, PatrimonyEntry, ReturnsEntry } from '@/types'

/** O dividendo rende mais uma vez o que pagou. */
export const DIVIDEND_BONUS_RATE = 1
/** Cada dólar aportado rende um quarto de dólar. */
export const CONTRIBUTION_BONUS_RATE = 0.25
/** O prêmio de uma categoria que venceu o benchmark num mês. */
export const CATEGORY_WIN_BONUS_USD = 250
/** Benchmark de uma categoria que não escolheu um — o mesmo da tela dela. */
export const DEFAULT_BENCHMARK = 'CDI'

/** Só o que já caiu na conta: um provento anunciado ainda não é dinheiro. */
export const receivedDividends = (dividends: Dividend[], today: string) =>
  dividends.filter(dividend => dividend.date <= today)

export const dividendBonusUsd = (amountUsd: number) => amountUsd * DIVIDEND_BONUS_RATE

/** Um quarto do aporte líquido da história inteira. Líquido porque vender e
 *  recomprar não é aportar: o bônus seria ganho duas vezes pelo mesmo
 *  dinheiro. Nunca negativo — quem sacou mais do que pôs só fica sem bônus. */
export function contributionBonusUsd(patrimony: PatrimonyEntry[]) {
  const net = patrimony.reduce((sum, entry) => sum + (typeof entry.aported === 'number' ? entry.aported : 0), 0)
  return Math.max(0, net) * CONTRIBUTION_BONUS_RATE
}

/** Um mês em que uma categoria rendeu mais do que o benchmark dela. */
export interface CategoryWin {
  categoryId: number
  category: string
  benchmark: string
  /** `AAAA-MM`. */
  month: string
  /** Retornos do mês, como fração. */
  categoryReturn: number
  benchmarkReturn: number
}

/** O retorno de cada mês de uma série acumulada: do último ponto do mês
 *  anterior ao último ponto do mês. O primeiro mês da série não tem de onde
 *  partir e fica de fora. */
export function monthlyReturns(series: { date: string; value: number }[]): Map<string, number> {
  const monthEnd = new Map<string, { date: string; value: number }>()
  for (const point of series) {
    const month = point.date.slice(0, 7)
    const seen = monthEnd.get(month)
    if (!seen || point.date > seen.date) monthEnd.set(month, point)
  }
  const months = [...monthEnd.keys()].sort()
  const returns = new Map<string, number>()
  for (let i = 1; i < months.length; i++) {
    const start = 1 + monthEnd.get(months[i - 1])!.value
    if (start <= 0) continue
    returns.set(months[i], (1 + monthEnd.get(months[i])!.value) / start - 1)
  }
  return returns
}

/** Os meses fechados em que cada categoria venceu o benchmark dela. O mês
 *  corrente não conta: ele ainda pode virar. Um mês sem a leitura das duas
 *  séries não é vitória nem derrota — fica de fora. */
export function categoryWins(
  entries: CategoryReturnEntry[],
  benchmarks: Record<string, ReturnsEntry[]>,
  benchmarkOf: Map<number, string>,
  today: string,
): CategoryWin[] {
  const currentMonth = today.slice(0, 7)
  const byCategory = new Map<number, { category: string; series: ReturnsEntry[] }>()
  for (const entry of entries) {
    const found = byCategory.get(entry.custom_category_id)
      ?? byCategory.set(entry.custom_category_id, { category: entry.category, series: [] }).get(entry.custom_category_id)!
    found.series.push({ date: entry.date, value: entry.acc_return })
  }

  const benchmarkMonths = new Map<string, Map<string, number>>()
  const wins: CategoryWin[] = []
  for (const [categoryId, { category, series }] of byCategory) {
    const benchmark = benchmarkOf.get(categoryId) ?? DEFAULT_BENCHMARK
    const benchmarkSeries = benchmarks[benchmark]
    if (!benchmarkSeries) continue
    if (!benchmarkMonths.has(benchmark)) benchmarkMonths.set(benchmark, monthlyReturns(benchmarkSeries))
    const reference = benchmarkMonths.get(benchmark)!
    for (const [month, categoryReturn] of monthlyReturns(series)) {
      const benchmarkReturn = reference.get(month)
      if (month >= currentMonth || benchmarkReturn == null || categoryReturn <= benchmarkReturn) continue
      wins.push({ categoryId, category, benchmark, month, categoryReturn, benchmarkReturn })
    }
  }
  return wins.sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category))
}

export interface CityBonuses {
  dividendUsd: number
  contributionUsd: number
  benchmarkUsd: number
  wins: CategoryWin[]
  totalUsd: number
}

export function cityBonuses({ dividendsUsd, patrimony, wins }: {
  dividendsUsd: number
  patrimony: PatrimonyEntry[]
  wins: CategoryWin[]
}): CityBonuses {
  const dividendUsd = dividendBonusUsd(dividendsUsd)
  const contributionUsd = contributionBonusUsd(patrimony)
  const benchmarkUsd = wins.length * CATEGORY_WIN_BONUS_USD
  return { dividendUsd, contributionUsd, benchmarkUsd, wins, totalUsd: dividendUsd + contributionUsd + benchmarkUsd }
}
