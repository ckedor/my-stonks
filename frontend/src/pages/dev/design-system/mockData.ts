import type { CandleDataPoint } from '@/components/charts/CandleChart'

function seed(s: number) {
  return () => {
    s = Math.sin(s) * 10000
    return s - Math.floor(s)
  }
}

export function generateCandleData(): CandleDataPoint[] {
  const rand = seed(42)
  const data: CandleDataPoint[] = []
  let price = 30

  const start = new Date('2020-01-02')
  const end = new Date('2026-04-04')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue

    const change = (rand() - 0.48) * 3
    const open = price
    const close = open + change
    const high = Math.max(open, close) + rand() * 1.5
    const low = Math.min(open, close) - rand() * 1.5
    const volume = Math.floor(500000 + rand() * 2000000)

    data.push({
      time: d.toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    })

    price = close
  }

  return data
}

export const MOCK_BAR_CHART_DATA = (() => {
  const rand = seed(99)
  const data: { date: string; value: number }[] = []
  const start = new Date('2021-04-01')
  const end = new Date('2026-04-01')
  let value = 50000

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue
    value += (rand() - 0.47) * 800
    value = Math.max(value, 10000)
    data.push({ date: d.toISOString().slice(0, 10), value: +value.toFixed(2) })
  }

  return data
})()

export const MOCK_PIE_DATA = [
  { label: 'Ações BR', value: 42000 },
  { label: 'Ações US', value: 28000 },
  { label: 'FIIs', value: 18000 },
  { label: 'Renda Fixa', value: 15000 },
  { label: 'Cripto', value: 9000 },
  { label: 'Previdência', value: 6000 },
]
