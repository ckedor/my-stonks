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