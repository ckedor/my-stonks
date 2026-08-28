import dayjs from 'dayjs'

type WithAmountAndDate = {
  amount: number
  date: string
}

export interface Last12MonthDividendStats {
  average: number
  total: number
}

export function getLast12MonthDividendStats<T extends WithAmountAndDate>(
  dividends: T[],
): Last12MonthDividendStats {
  const startMonth = dayjs().startOf('month').subtract(11, 'month')
  const monthlyTotals = new Map<string, number>()

  for (let index = 0; index < 12; index++) {
    const monthKey = startMonth.add(index, 'month').format('YYYY-MM')
    monthlyTotals.set(monthKey, 0)
  }

  for (const dividend of dividends) {
    const date = dayjs(dividend.date)
    if (date.isBefore(startMonth, 'day')) continue

    const monthKey = date.startOf('month').format('YYYY-MM')
    if (!monthlyTotals.has(monthKey)) continue

    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + dividend.amount)
  }

  const total = Array.from(monthlyTotals.values()).reduce((sum, value) => sum + value, 0)

  return {
    total,
    average: total / 12,
  }
}

export interface MonthlyDividendRow {
  /** Rótulo do mês, como o eixo desenha. */
  month: string
  /** Total do mês em cada um dos dois anos, pela chave do ano. */
  [year: string]: string | number
}

export interface MonthlyDividendSeries {
  /** O ano mais recente com provento, e não necessariamente o de hoje: uma
   *  carteira que parou de receber ainda tem o que mostrar. */
  currentYear: number
  previousYear: number
  rows: MonthlyDividendRow[]
}

/** Os proventos de dois anos, mês a mês, prontos para um gráfico de barras.
 *
 *  Os doze meses existem sempre, mesmo vazios: sem eles o eixo encolhe
 *  conforme o mês em que se está, e dois gráficos lado a lado deixam de ser
 *  comparáveis. É por isso que, em agosto, setembro aparece — com o valor do
 *  ano anterior, quando há. Quem diz de que ano é cada barra é a legenda. */
export function groupDividendsByMonthAndYear<T extends WithAmountAndDate>(
  dividends: T[],
): MonthlyDividendSeries {
  const mostRecent = dividends.reduce<T | undefined>(
    (latest, dividend) =>
      !latest || dayjs(latest.date).isBefore(dividend.date) ? dividend : latest,
    undefined,
  )
  const currentYear = mostRecent ? dayjs(mostRecent.date).year() : dayjs().year()
  const previousYear = currentYear - 1

  const byMonth = new Map<string, MonthlyDividendRow>()
  for (let month = 0; month < 12; month++) {
    /* O rótulo sai de uma data no dia 1: `dayjs().month(n)` parte de hoje, e
       num dia 31 o mês curto transborda para o seguinte. */
    const label = dayjs().startOf('month').month(month).format('MMM')
    byMonth.set(label, { month: label })
  }

  for (const dividend of dividends) {
    const date = dayjs(dividend.date)
    const year = date.year()
    if (year !== previousYear && year !== currentYear) continue

    const row = byMonth.get(date.format('MMM'))
    if (!row) continue

    const key = String(year)
    row[key] = ((row[key] as number) ?? 0) + dividend.amount
  }

  return { currentYear, previousYear, rows: [...byMonth.values()] }
}
