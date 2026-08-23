import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import { Dividend } from '@/types'
import { AppChartArea, AppStack, AppText, useAppTheme } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface Props {
  dividends: Dividend[]
  selected: string
  size?: number | string
}

export default function OverviewDividendsChart({ dividends, selected, size = 340 }: Props) {
  const theme = useAppTheme()
  const { format: formatCurrency, locale } = useCurrency()

  const filtered = useMemo(
    () => (selected === 'portfolio' ? dividends : dividends.filter((d) => d.category === selected)),
    [dividends, selected]
  )

  const { currentYear, previousYear, data, average12m } = useMemo(() => {
    const mostRecent = filtered.reduce<Dividend | undefined>(
      (a, b) => (!a || dayjs(a.date).isBefore(b.date) ? b : a),
      undefined
    )
    const currentYear = mostRecent ? dayjs(mostRecent.date).year() : dayjs().year()
    const previousYear = currentYear - 1

    const monthlyMap: Record<string, { month: string; [key: string]: string | number }> = {}
    for (let i = 0; i < 12; i++) {
      const m = dayjs().month(i).format('MMM')
      monthlyMap[m] = { month: m }
    }

    for (const d of filtered) {
      const dt = dayjs(d.date)
      const y = dt.year()
      if (y !== previousYear && y !== currentYear) continue
      const m = dt.format('MMM')
      const key = String(y)
      monthlyMap[m][key] = ((monthlyMap[m][key] as number) || 0) + d.amount
    }

    const { average } = getLast12MonthDividendStats(filtered)

    return { currentYear, previousYear, data: Object.values(monthlyMap), average12m: average }
  }, [filtered])

  const labelColor = theme.palette.chart.label

  return (
    <AppChartArea
      height={size}
      sizing="frame"
      emptyMessage={filtered.length ? undefined : 'Sem dividendos no período'}
      toolbar={
        <AppStack direction="row" justify="end" align="baseline" gap="xs">
          <AppText variant="bodySmall" tone="secondary">
            Média 12 meses:
          </AppText>
          <AppText variant="bodySmall" weight="strong">
            {formatCurrency(average12m)}
          </AppText>
        </AppStack>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <XAxis
            dataKey="month"
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            orientation="right"
            stroke={labelColor}
            tick={{ fill: labelColor, fontSize: 12 }}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `${(v / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`
                : v.toLocaleString(locale)
            }
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              fontSize: 13,
            }}
            formatter={(value: number) => [formatCurrency(value)]}
          />
          <Bar
            dataKey={String(previousYear)}
            name={`${previousYear}`}
            fill={theme.palette.primary.main}
            radius={[4, 4, 0, 0]}
            opacity={0.4}
          />
          <Bar
            dataKey={String(currentYear)}
            name={`${currentYear}`}
            fill={theme.palette.primary.main}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
