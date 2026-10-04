import AppBarChart from '@/components/charts/app-bar-chart/AppBarChart'
import CandleChart from '@/components/charts/CandleChart'
import {
  AppCard,
  AppChartArea,
  AppDivergingBars,
  AppGrid,
  AppPieChart,
  AppSkeleton,
  AppStack,
  AppText,
  AppTreemap,
  useAppTheme,
} from '@/components/ui'
import { useMemo } from 'react'
import { generateCandleData, MOCK_BAR_CHART_DATA, MOCK_PIE_DATA } from './mockData'
import { Entry, State } from './Specimen'

const TOOLBAR = (
  <AppText variant="bodySmall" weight="strong">
    Patrimônio
  </AppText>
)

const DIVERGING = [
  { key: 1, label: 'PETR4', value: 12.4, display: '+12,4%' },
  { key: 2, label: 'HGLG11', value: -4.2, display: '−4,2%' },
  { key: 3, label: 'BOVA11', value: 8.8, display: '+8,8%' },
  { key: 4, label: 'VALE3', value: -1.5, display: '−1,5%' },
]

export default function ChartsFamily() {
  const theme = useAppTheme()
  const colors = theme.palette.chart.colors
  const candleData = useMemo(() => generateCandleData(), [])

  const treemap = [
    {
      label: 'Ações',
      items: [
        { key: 'petr4', label: 'PETR4', value: 13800, valueDisplay: 'R$ 13,8 mil', tint: colors[0] },
        { key: 'bova11', label: 'BOVA11', value: 4877, valueDisplay: 'R$ 4,9 mil', tint: colors[0] },
      ],
    },
    {
      label: 'FIIs',
      items: [{ key: 'hglg11', label: 'HGLG11', value: 13113, valueDisplay: 'R$ 13,1 mil', tint: colors[1] }],
    },
  ]

  return (
    <AppStack gap="lg">
      <Entry
        name="AppChartArea"
        role="A moldura de todo gráfico: controles em cima, desenho embaixo, altura declarada. Vazia ou carregando, ocupa a mesma altura."
      >
        <AppGrid cols={{ xs: 1, md: 3 }} gap="md">
          <State label="toolbar · note">
            <AppCard>
              <AppChartArea height={120} toolbar={TOOLBAR} note="2026">
                <AppSkeleton height="100%" />
              </AppChartArea>
            </AppCard>
          </State>
          <State label="loading">
            <AppCard>
              <AppChartArea height={120} toolbar={TOOLBAR} loading />
            </AppCard>
          </State>
          <State label="emptyMessage">
            <AppCard>
              <AppChartArea height={120} toolbar={TOOLBAR} emptyMessage="Sem dados no período" />
            </AppCard>
          </State>
        </AppGrid>
      </Entry>

      <Entry name="AppPieChart" role="Rosca de participação. A cor de cada fatia é a identidade da série, e só ela.">
        <AppPieChart data={MOCK_PIE_DATA} height={300} isCurrency colors={colors} />
      </Entry>

      <Entry
        name="AppTreemap"
        role="Participação em retângulos, agrupados. Para muitos itens, onde a rosca vira fatias finas demais para ler."
      >
        <AppTreemap
          groups={treemap}
          height={220}
          backgroundColor={theme.palette.background.paper}
          labelColor={theme.palette.text.primary}
        />
      </Entry>

      <Entry name="AppDivergingBars" role="Barras a partir do zero, para a direita o que ganhou e para a esquerda o que perdeu.">
        <AppDivergingBars bars={DIVERGING} />
      </Entry>

      <Entry
        name="CandleChart"
        role="Gráfico de domínio (src/components/charts), não do design system: velas e volume em lightweight-charts. Fica aqui como referência de como os controles da barra se compõem."
      >
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
      </Entry>

      <Entry
        name="AppBarChart"
        role="Gráfico de domínio (src/components/charts): barras no tempo em Recharts, com período e agrupamento."
      >
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
      </Entry>
    </AppStack>
  )
}
