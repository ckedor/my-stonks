
import { useCurrency } from '@/hooks/useCurrency'
import { Dividend } from '@/types'
import { AppChartArea, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface Props {
  dividends: Dividend[]
  selected: string
  size?: number
}

export default function PortfolioDividendsChartByYear({ dividends, selected, size = 370 }: Props) {
  
  const theme = useAppTheme()
  const { symbol, locale } = useCurrency()

  const filtered =
    selected === 'portfolio' ? dividends : dividends.filter((d) => d.category === selected)

  // anos: atual (pelo dado mais recente) e anterior
  const mostRecent = filtered.reduce<Dividend | undefined>(
    (a, b) => (!a || dayjs(a.date).isBefore(b.date) ? b : a),
    undefined
  )
  const currentYear = mostRecent ? dayjs(mostRecent.date).year() : dayjs().year()
  const previousYear = currentYear - 1

  // monta 12 meses e acumula valores por mês/ano (somente anos prev/atual)
  const monthlyMap: Record<string, { month: string; [year: number]: number }> = {}
  for (let i = 0; i < 12; i++) {
    const m = dayjs().month(i).format('MMM')
    monthlyMap[m] = { month: m }
  }

  for (const d of filtered) {
    const dt = dayjs(d.date)
    const y = dt.year()
    if (y !== previousYear && y !== currentYear) continue
    const m = dt.format('MMM')
    monthlyMap[m][y] = (monthlyMap[m][y] || 0) + d.amount
  }

  const data = Object.values(monthlyMap)

  // eixo Y e linha de referência (média simples das barras existentes)
  const values = data.flatMap((r) => [r[previousYear] ?? 0, r[currentYear] ?? 0])
  const max = Math.max(...values)
  const upper = Math.ceil((max || 1) * 1.5)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

  const yTicks: number[] = []
  const tickStep = 50
  for (let i = 0; i <= upper; i += tickStep) yTicks.push(i)

  if (!filtered.length) {
    return <AppChartArea height={size} emptyMessage="Ativo não recebeu dividendos no período" />
  }

  return (
    <AppChartArea height={size}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 48 }}>
          <CartesianGrid 
          strokeDasharray="3 3" 
          stroke={theme.palette.chart.grid} />
          <XAxis 
            dataKey="month"
            stroke={theme.palette.text.primary}
          />
          <YAxis
            orientation="right"
            domain={[0, upper]}
            ticks={yTicks}
            tickFormatter={(v) => `${symbol} ${v.toLocaleString(locale)}`}
            tick={{ fontSize: 13 }}
            stroke={theme.palette.text.primary}
          />
          <Tooltip
            formatter={(value: number) =>
              `${symbol} ${value.toLocaleString(locale, { maximumFractionDigits: 2 })}`
            }
          />
          <Legend />
          <Bar
            dataKey={previousYear}
            name={`${previousYear}`}
            fill={theme.palette.primary.main}
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey={currentYear} name={`${currentYear}`} fill={theme.palette.secondary.main} radius={[4, 4, 0, 0]} />
          <ReferenceLine 
            y={avg} 
            stroke={theme.palette.text.primary} 
            strokeDasharray="5 5" 
            strokeWidth={1.5} />
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
