import { useId } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReadingPoint } from '@/api/market'
import { AppChartArea, useAppTheme } from '@/components/ui'
import { formatDate } from '@/lib/utils/format'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface Props {
  points: ReadingPoint[]
  height: number
  /** Como o valor aparece no tooltip. */
  format: (value: number) => string
  /** Formato dos rótulos do eixo, quando o do tooltip é longo demais. */
  tickFormat?: (value: number) => string
  /** Nome do valor no tooltip: "Nível", "Taxa". */
  valueLabel: string
  /** Desenha a média de 40 semanas junto do nível. */
  showMovingAverage?: boolean
  /** Uma linha de referência, como o zero de um juro real. */
  reference?: number
  /** Eixos visíveis: o gráfico grande tem, a miniatura não. */
  axes?: boolean
  label: string
}

/** A trajetória de uma leitura, com a média longa quando ela faz sentido.
 *
 *  A cor é a primeira do tema e não o verde ou o vermelho da variação: a
 *  mesma linha sobe e desce dentro da janela, e pintá-la pelo saldo final
 *  diria que ela só subiu ou só caiu. */
export default function ReadingChart({
  points,
  height,
  format,
  tickFormat = format,
  valueLabel,
  showMovingAverage = false,
  reference,
  axes = false,
  label,
}: Props) {
  const theme = useAppTheme()
  const id = useId().replace(/:/g, '')
  const color = theme.palette.chart.colors[0]
  /* Com menos de dois anos na tela, o ano sozinho se repete em todo rótulo do
     eixo: o mês entra junto. */
  const spanDays =
    points.length > 1
      ? (Date.parse(points[points.length - 1].date) - Date.parse(points[0].date)) / 86_400_000
      : 0
  const tickDate = (value: string) =>
    spanDays < 730
      ? `${MONTHS[Number(value.slice(5, 7)) - 1]}/${value.slice(2, 4)}`
      : value.slice(0, 4)
  const muted = theme.palette.chart.label
  return (
    <AppChartArea height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 6, right: axes ? 8 : 2, bottom: 2, left: axes ? 0 : 2 }}
          accessibilityLayer
          aria-label={label}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            hide={!axes}
            tickFormatter={tickDate}
            tick={{ fill: muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            hide={!axes}
            domain={['auto', 'auto']}
            tickFormatter={tickFormat}
            tick={{ fill: muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={axes ? 72 : 0}
          />
          {reference != null && (
            <ReferenceLine y={reference} stroke={theme.palette.divider} strokeDasharray="3 3" />
          )}
          <Tooltip
            labelFormatter={(value) => formatDate(String(value))}
            formatter={(value, name) => [
              format(Number(value)),
              name === 'moving_average' ? 'Média de 40 semanas' : valueLabel,
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
          {showMovingAverage && (
            <Line
              type="monotone"
              dataKey="moving_average"
              stroke={muted}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </AppChartArea>
  )
}
