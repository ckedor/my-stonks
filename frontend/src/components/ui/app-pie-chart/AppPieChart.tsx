
import { useCurrency } from '@/hooks/useCurrency'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import OuterLabel from './OuterLabel'
import PercentageLabel from './PercentageLabel'

type AppPieChartProps = {
  data: { label: string; value: number }[]
  height: number
  isCurrency?: boolean
  colors?: string[]
  onItemClick?: (label: string) => void
  minOuterLabelPercentage?: number
  /** Fatias que saem do desenho e deixam as outras ocuparem o círculo, para
   *  comparar o que sobrou. A porcentagem escrita continua sendo a do total
   *  inteiro, e o tooltip também. */
  hiddenLabels?: string[]
}

export default function AppPieChart({
  data,
  height,
  isCurrency = false,
  colors,
  onItemClick,
  minOuterLabelPercentage = 0,
  hiddenLabels,
}: AppPieChartProps) {
  const theme = useTheme()
  const { format: formatCurrency } = useCurrency()
  const fallbackColors = theme.palette.chart.colors
  const activeColors = colors?.length ? colors : fallbackColors
  const bgPage   = theme.palette.background.default
  const textMain = theme.palette.text.primary

  const hidden = new Set(hiddenLabels)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const shown = data.map((item, index) => ({ item, index })).filter(({ item }) => !hidden.has(item.label))
  const drawn = shown.map(({ item }) => item)
  const drawnColors = shown.map(({ index }) => activeColors[index % activeColors.length])
  const labels = drawn.map((item) => item.label)
  /* O anel é refeito só com o que sobrou, mas o número escrito é a fatia no
     total: esconder um ativo não altera a porcentagem dos outros. */
  const ofTotal = (index?: number) =>
    total > 0 && index != null ? drawn[index].value / total : 0

  return (
    <Box
      sx={{
        height,
        '& .recharts-sector:focus': { outline: 'none' },
        '& .recharts-text:focus': { outline: 'none' },
        '& .recharts-pie-label-text:focus': { outline: 'none' },
        '& .recharts-tooltip-wrapper:focus': { outline: 'none' },
        '& .recharts-text tspan': { fill: textMain },
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={drawn}
            dataKey="value"
            nameKey="label"
            innerRadius="48%"
            outerRadius="82%"
            isAnimationActive={false}
            labelLine={false}
            label={(props) => (
              <PercentageLabel
                {...props}
                percent={ofTotal(props.index)}
                minPercentage={minOuterLabelPercentage}
              />
            )}
            startAngle={90}
            endAngle={-270}
            stroke={bgPage}
            strokeWidth={0}
            onClick={(entry) => onItemClick?.(entry.label)}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          >
            {drawn.map((_, index) => (
              <Cell key={`cell-${index}`} fill={drawnColors[index]} />
            ))}
          </Pie>

          <Pie
            data={drawn}
            dataKey="value"
            nameKey="label"
            outerRadius="87%"
            fill="none"
            stroke="none"
            isAnimationActive={false}
            labelLine={false}
            label={(props) => (
              <OuterLabel
                {...props}
                percent={ofTotal(props.index)}
                labels={labels}
                minPercentage={minOuterLabelPercentage}
              />
            )}
            startAngle={90}
            endAngle={-270}
            tooltipType="none"
          />

          <Tooltip
            formatter={(value: number, name: string) => {
              const percentage = total > 0 ? (Number(value) / total) * 100 : 0
              const formattedValue = isCurrency
                ? formatCurrency(value)
                : value
              return [`${formattedValue} (${percentage.toFixed(1)}%)`, name]
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  )
}
