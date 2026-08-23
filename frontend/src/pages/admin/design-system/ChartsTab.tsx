import AppBarChart from '@/components/charts/app-bar-chart/AppBarChart'
import CandleChart from '@/components/charts/CandleChart'
import AppPieChart from '@/components/ui/app-pie-chart/AppPieChart'
import { AppCard, AppStack, AppText, SectionTitle, useAppTheme } from '@/components/ui'
import { useMemo } from 'react'
import { generateCandleData, MOCK_BAR_CHART_DATA, MOCK_PIE_DATA } from './mockData'

export default function ChartsTab() {
  const theme = useAppTheme()
  const candleData = useMemo(() => generateCandleData(), [])

  return (
    <AppStack gap="xl">
      {/* ── Candle Chart ── */}
      <AppCard>
        <AppStack gap="sm">
          <AppStack gap="none">
            <SectionTitle>CandleChart</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              lightweight-charts wrapper with volume histogram
            </AppText>
          </AppStack>
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
        </AppStack>
      </AppCard>

      {/* ── Bar Chart ── */}
      <AppCard>
        <AppStack gap="sm">
          <AppStack gap="none">
            <SectionTitle>AppBarChart</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              Time-series bar chart (Recharts) — monthly patrimony
            </AppText>
          </AppStack>
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
        </AppStack>
      </AppCard>

      {/* ── Pie Chart ── */}
      <AppCard>
        <AppStack gap="sm">
          <AppStack gap="none">
            <SectionTitle>AppPieChart</SectionTitle>
            <AppText variant="bodySmall" tone="secondary">
              Donut pie chart (visx) — portfolio allocation
            </AppText>
          </AppStack>
          <AppPieChart
            data={MOCK_PIE_DATA}
            height={300}
            isCurrency
            colors={theme.palette.chart.colors}
          />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
