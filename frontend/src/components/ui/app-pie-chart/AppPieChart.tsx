
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
}

export default function AppPieChart({
  data,
  height,
  isCurrency = false,
  colors,
  onItemClick,
  minOuterLabelPercentage = 0,
}: AppPieChartProps) {
  const theme = useTheme()
  const { format: formatCurrency } = useCurrency()
  const fallbackColors = theme.palette.chart.colors
  const activeColors = colors?.length ? colors : fallbackColors
  const bgPage   = theme.palette.background.default
  const textMain = theme.palette.text.primary

  const labels = data.map((item) => item.label)

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
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="48%"
            outerRadius="82%"
            isAnimationActive={false}
            labelLine={false}
            label={PercentageLabel}
            startAngle={90}
            endAngle={-270}
            stroke={bgPage}
            strokeWidth={0}
            onClick={(entry) => onItemClick?.(entry.label)}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={activeColors[index % activeColors.length]} />
            ))}
          </Pie>

          <Pie
            data={data}
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
                labels={labels}
                minPercentage={minOuterLabelPercentage}
              />
            )}
            startAngle={90}
            endAngle={-270}
            tooltipType="none"
          />

          <Tooltip
            formatter={(value: number) =>
              isCurrency
                ? formatCurrency(value)
                : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  )
}
