import {
  AppStack,
  AppText,
  AppTreemap,
  useAppTheme,
  type AppTreemapGroup,
  type AppTreemapLeaf,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { PortfolioPositionEntry } from '@/types'
import { scaleLinear } from '@visx/scale'
import { useMemo } from 'react'
import type { DistributionMetric } from './PerformanceBarChart'

interface PortfolioHeatMapProps {
  positions: PortfolioPositionEntry[]
  metric?: DistributionMetric
  onAssetSelect?: (assetId: number) => void
}

const NO_CATEGORY = '(Sem categoria)'

/** O mapa ocupa o que sobra da tela abaixo da barra superior e do cabeçalho
 *  da página. Os 210px são a soma do que está acima dele, e mudaram quando o
 *  cabeçalho padrão trouxe o rastro de navegação — quem cobra a conta é o
 *  `expectNothingClipped` do e2e, que falha dizendo por quantos pixels. */
const HEIGHT = 'calc(100vh - 210px)'

/* Extremos da escala de cor, por métrica. Um lucro de cem mil e uma
   rentabilidade de 30% são o mesmo verde: é o teto de cada uma. */
const COLOR_DOMAIN: Record<DistributionMetric, number[]> = {
  profit: [-50000, 0, 100000],
  cagr: [-0.2, 0, 0.3],
  twelve_months_return: [-0.2, 0, 0.3],
  acc_return: [-0.2, 0, 0.3],
}

const COLOR_RANGE = ['rgb(206, 43, 43)', 'rgb(117, 117, 117)', 'rgb(39, 174, 96)']

function getMetricValue(pos: PortfolioPositionEntry, metric: DistributionMetric): number {
  switch (metric) {
    case 'profit':
      return (pos.value ?? 0) - (pos.total_invested ?? 0)
    case 'cagr':
      return pos.cagr ?? 0
    case 'twelve_months_return':
      return pos.twelve_months_return ?? 0
    case 'acc_return':
      return pos.acc_return ?? 0
  }
}

function formatMetricDisplay(
  value: number,
  metric: DistributionMetric,
  fmtCurrency?: (v: number) => string,
): string {
  if (metric === 'profit') {
    return fmtCurrency ? fmtCurrency(value) : `R$ ${(value / 1000).toFixed(1)}k`
  }
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export default function PortfolioHeatMap({
  positions,
  metric = 'twelve_months_return',
  onAssetSelect,
}: PortfolioHeatMapProps) {
  const theme = useAppTheme()
  const { format: formatCurrency } = useCurrency()

  const total = positions.reduce((sum, p) => sum + p.value, 0)

  const colorScale = useMemo(
    () => scaleLinear<string>({ domain: COLOR_DOMAIN[metric], range: COLOR_RANGE, clamp: true }),
    [metric],
  )

  /* Categorias em ordem de tamanho: a maior nasce no canto superior
     esquerdo, que é por onde se começa a ler. */
  const groups: AppTreemapGroup[] = useMemo(() => {
    const byCategory = positions.reduce<Record<string, PortfolioPositionEntry[]>>((acc, pos) => {
      const key = pos.category || NO_CATEGORY
      if (!acc[key]) acc[key] = []
      acc[key].push(pos)
      return acc
    }, {})

    const categoryTotal = (items: PortfolioPositionEntry[]) =>
      items.reduce((sum, pos) => sum + pos.value, 0)

    return Object.entries(byCategory)
      .sort(([, a], [, b]) => categoryTotal(b) - categoryTotal(a))
      .map(([category, items]) => ({
        label: category,
        items: items.map((pos) => {
          const metricValue = getMetricValue(pos, metric)
          return {
            key: pos.asset_id,
            label: pos.ticker,
            caption: formatMetricDisplay(metricValue, metric, formatCurrency),
            value: pos.value,
            tint: colorScale(metricValue),
          }
        }),
      }))
  }, [positions, metric, colorScale, formatCurrency])

  const renderTooltip = (leaf: AppTreemapLeaf) => {
    const pos = positions.find((item) => item.asset_id === leaf.key)
    if (!pos) return null

    const pct = total > 0 ? (pos.value / total) * 100 : 0
    const invested = pos.total_invested ?? 0

    return (
      <AppStack gap="xs">
        <AppText variant="caption" weight="strong">
          {pos.ticker}
        </AppText>
        <AppText variant="caption">Valor: {formatCurrency(pos.value)}</AppText>
        <AppText variant="caption">Participação: {pct.toFixed(2)}%</AppText>
        <AppText variant="caption">
          {formatMetricDisplay(getMetricValue(pos, metric), metric, formatCurrency)}
        </AppText>
        {invested > 0 && (
          <AppText variant="caption">Investido: {formatCurrency(invested)}</AppText>
        )}
      </AppStack>
    )
  }

  return (
    <AppTreemap
      groups={groups}
      height={HEIGHT}
      onSelect={(key) => onAssetSelect?.(Number(key))}
      renderTooltip={renderTooltip}
      backgroundColor={theme.palette.background.default}
      labelColor={theme.palette.text.primary}
    />
  )
}
