import AppBarChart from '@/components/charts/app-bar-chart/AppBarChart'
import CandleChart from '@/components/charts/CandleChart'
import AppPieChart from '@/components/ui/app-pie-chart/AppPieChart'
import AppCard from '@/components/ui/AppCard'
import { Stack, Typography, useTheme } from '@mui/material'
import { useMemo } from 'react'
import {
    generateCandleData,
    MOCK_BAR_CHART_DATA,
    MOCK_PIE_DATA,
} from './mockData'

export default function ChartsTab() {
  const theme = useTheme()
  const candleData = useMemo(() => generateCandleData(), [])

  return (
    <Stack spacing={4}>
      {/* ── Candle Chart ── */}
      <AppCard>
        <Typography variant="h6" gutterBottom>CandleChart</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          lightweight-charts wrapper with volume histogram
        </Typography>
        <CandleChart
          data={candleData}
          height={400}
          showVolumeToggle
          showRangePicker
          showTimeframeSelector
          showTypeToggle
          showPriceScaleModeToggle
          showMeasureToggle
          showPerformance
        />
      </AppCard>

      {/* ── Bar Chart ── */}
      <AppCard>
        <Typography variant="h6" gutterBottom>AppBarChart</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Time-series bar chart (Recharts) — monthly patrimony
        </Typography>
        <AppBarChart
          data={MOCK_BAR_CHART_DATA}
          height={280}
          valueType="currency"
          colorMode="single"
          groupBy="day"
          showRangePicker
          showGroupBySelector
          defaultRange="1y"
        />
      </AppCard>

      {/* ── Pie Chart ── */}
      <AppCard>
        <Typography variant="h6" gutterBottom>AppPieChart</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Donut pie chart (visx) — portfolio allocation
        </Typography>
        <AppPieChart
          data={MOCK_PIE_DATA}
          height={300}
          isCurrency
          colors={theme.palette.chart.colors}
        />
      </AppCard>
    </Stack>
  )
}
