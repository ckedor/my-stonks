
import { useCurrency } from '@/hooks/useCurrency'
import { groupDividendsByMonthAndYear } from '@/lib/utils/dividends'
import { Dividend } from '@/types'
import { AppChartArea, useAppTheme } from '@/components/ui'
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

  const { currentYear, previousYear, rows: data } = groupDividendsByMonthAndYear(filtered)

  // eixo Y e linha de referência (média simples das barras existentes)
  const values = data.flatMap((r) => [
    (r[previousYear] as number) ?? 0,
    (r[currentYear] as number) ?? 0,
  ])
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
