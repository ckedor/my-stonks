import { useCurrency } from '@/hooks/useCurrency'
import {
  getLast12MonthDividendStats,
  groupDividendsByMonthAndYear,
} from '@/lib/utils/dividends'
import { Dividend } from '@/types'
import { AppChartArea, AppStack, AppText, useAppTheme } from '@/components/ui'
import { useMemo } from 'react'
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
    const { currentYear, previousYear, rows } = groupDividendsByMonthAndYear(filtered)
    const { average } = getLast12MonthDividendStats(filtered)

    return { currentYear, previousYear, data: rows, average12m: average }
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
            /* O ano vem junto do valor. Sem ele, uma barra num mês que ainda
               não chegou não tinha como ser lida pelo que é — o mesmo mês do
               ano passado. */
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
          />
          {/* Duas séries pedem legenda. Sem ela, e com as duas na mesma cor,
              o gráfico dizia "houve provento em setembro" estando em agosto:
              a barra era a de setembro do ano anterior, e nada na tela
              contava isso. É a mesma leitura do gráfico de proventos da tela
              de Proventos, e agora nas mesmas cores. */}
          <Legend />
          <Bar
            dataKey={String(previousYear)}
            name={`${previousYear}`}
            fill={theme.palette.primary.main}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey={String(currentYear)}
            name={`${currentYear}`}
            fill={theme.palette.secondary.main}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
