import {
  filterByRange,
  formatXAxisTick,
  groupTimeSeries,
  type GroupBy,
} from '@/components/charts/app-bar-chart/helpers'
import { AppChartArea, AppSelect, AppStack, useAppTheme } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { PatrimonyEntry } from '@/types'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

/* Aportes na linguagem visual dos vizinhos de aba.
 *
 * `PortfolioMonthlyAportsChart` continua sendo o gráfico da tela de
 * patrimônio, onde o assunto é a série inteira. Aqui a aba divide espaço com
 * Proventos e Patrimônio, e as três são leitura de relance: sem grade, sem
 * linha de eixo, valores à direita. O que o gráfico diz é o mesmo de sempre —
 * o último ano, verde quando entrou dinheiro e vermelho quando saiu.
 *
 * `aported` é líquido e não tem recorte por categoria: venda entra com
 * quantidade negativa, então resgate já desconta sozinho, e a série é a mesma
 * para qualquer categoria selecionada na tela. */

interface Props {
  patrimonyEvolution: PatrimonyEntry[]
  size?: number | string
}

const GROUP_BY_OPTIONS = [
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensal' },
]

export default function OverviewAportsChart({ patrimonyEvolution, size = 340 }: Props) {
  const theme = useAppTheme()
  const { format: formatCurrency, locale } = useCurrency()
  const [groupBy, setGroupBy] = useState<GroupBy>('month')

  const chartData = useMemo(() => {
    const series = patrimonyEvolution
      .filter((entry) => Number.isFinite(entry.aported as number))
      .map((entry) => ({
        date: dayjs(entry.date).format('YYYY-MM-DD'),
        value: entry.aported as number,
      }))

    return groupTimeSeries(filterByRange(series, '1y'), groupBy)
  }, [patrimonyEvolution, groupBy])

  const labelColor = theme.palette.chart.label
  const hasData = chartData.some((point) => point.value !== 0)

  return (
    <AppChartArea
      height={size}
      sizing="frame"
      emptyMessage={hasData ? undefined : 'Sem aportes no período'}
      toolbar={
        <AppStack direction="row" justify="end">
          <AppSelect
            size="auto"
            options={GROUP_BY_OPTIONS}
            value={groupBy}
            onChange={(value) => setGroupBy(value as GroupBy)}
          />
        </AppStack>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatXAxisTick(String(value), groupBy)}
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
              Math.abs(v) >= 1000
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
            labelFormatter={(value) => formatXAxisTick(String(value), groupBy)}
            formatter={(value: number) => [formatCurrency(value), 'Aportes']}
          />
          <Bar dataKey="value" name="Aportes" radius={[4, 4, 0, 0]}>
            {chartData.map((point) => (
              <Cell
                key={point.date}
                fill={point.value >= 0 ? theme.palette.success.main : theme.palette.error.main}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
