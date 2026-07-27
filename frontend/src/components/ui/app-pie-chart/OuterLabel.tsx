
import { useTheme } from '@mui/material'
import { PieLabelRenderProps } from 'recharts'

type OuterLabelProps = PieLabelRenderProps & {
  labels: string[]
  minPercentage: number
}

export default function OuterLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  index,
  labels,
  minPercentage,
}: OuterLabelProps) {
  const theme = useTheme()

  if (
    typeof index !== 'number' ||
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    typeof midAngle !== 'number' ||
    typeof outerRadius !== 'number' ||
    Number(percent) * 100 < minPercentage
  ) {
    return null
  }

  const RADIAN = Math.PI / 180
  const radius = outerRadius + 16
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill={theme.palette.text.primary}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={14}
      style={{ pointerEvents: 'none' }}
    >
      {labels[index]}
    </text>
  )
}
