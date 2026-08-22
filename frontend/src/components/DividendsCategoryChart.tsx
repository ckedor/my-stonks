import { useCurrency } from '@/hooks/useCurrency'
import { Dividend } from '@/types'
import { AppCard, AppChartArea, AppDivider, AppStack, AppText, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface Props {
  dividends: Dividend[]
  categoryColors: Record<string, string>
  year: number
  size?: number
}

export default function DividendsCategoryChart({ dividends, categoryColors, year, size = 370 }: Props) {
  const theme = useAppTheme()
  const { symbol, locale } = useCurrency()

  const currentYear = year

  const categories = Array.from(new Set(dividends.map((d) => d.category))).sort()

  const data = Array.from({ length: 12 }, (_, i) => {
    const entry: Record<string, any> = { month: dayjs().month(i).format('MMM') }
    categories.forEach((cat) => {
      entry[cat] = dividends
        .filter((d) => {
          const dt = dayjs(d.date)
          return dt.year() === currentYear && dt.month() === i && d.category === cat
        })
        .reduce((sum, d) => sum + d.amount, 0)
    })
    return entry
  })

  if (!dividends.length) {
    return <AppChartArea height={size} emptyMessage="Nenhum provento encontrado" />
  }

  const monthTotals = data.map((r) =>
    categories.reduce((sum, c) => sum + ((r[c] as number) || 0), 0)
  )
  const max = Math.max(...monthTotals)
  const upper = Math.ceil((max || 1) * 1.3)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
    return (
      <AppCard raised padding="sm">
        <AppStack gap="xs">
          <AppText variant="bodySmall" weight="strong">
            {label} / {currentYear}
          </AppText>
          {/* A cor de cada linha é a da barra que ela explica: sem isso, com
              três categorias empilhadas, não dá para saber qual é qual. */}
          {payload.map((p: any, i: number) => (
            <AppText key={i} variant="bodySmall" tint={p.fill}>
              {p.name}: {symbol} {p.value.toLocaleString(locale, { maximumFractionDigits: 2 })}
            </AppText>
          ))}
          {payload.length > 1 && (
            <>
              <AppDivider />
              <AppText variant="bodySmall" weight="strong">
                Total: {symbol} {total.toLocaleString(locale, { maximumFractionDigits: 2 })}
              </AppText>
            </>
          )}
        </AppStack>
      </AppCard>
    )
  }

  return (
    <AppChartArea height={size} note={String(currentYear)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.chart.grid} />
          <XAxis dataKey="month" stroke={theme.palette.text.primary} />
          <YAxis
            orientation="right"
            domain={[0, upper]}
            tickFormatter={(v: number) => `${symbol} ${v.toLocaleString(locale)}`}
            tick={{ fontSize: 13 }}
            stroke={theme.palette.text.primary}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {categories.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="dividends"
              fill={categoryColors[cat] || theme.palette.primary.main}
              name={cat}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
