import { AppDivergingBars, AppStack, AppText, type AppDivergingBar } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { PortfolioPositionEntry } from '@/types'
import { useMemo } from 'react'

export type DistributionMetric = 'twelve_months_return' | 'acc_return' | 'cagr' | 'profit'

interface PerformanceBarChartProps {
  positions: PortfolioPositionEntry[]
  metric: DistributionMetric
  onAssetSelect?: (assetId: number) => void
}

const METRIC_LABELS: Record<DistributionMetric, string> = {
  twelve_months_return: 'Rent. 12M',
  acc_return: 'Rent. Acumulada',
  cagr: 'CAGR',
  profit: 'Lucro Absoluto',
}

function getMetricValue(pos: PortfolioPositionEntry, metric: DistributionMetric): number {
  switch (metric) {
    case 'profit':
      return (pos.value ?? 0) - (pos.total_invested ?? 0)
    case 'cagr':
      return (pos.cagr ?? 0) * 100
    case 'twelve_months_return':
      return (pos.twelve_months_return ?? 0) * 100
    case 'acc_return':
      return (pos.acc_return ?? 0) * 100
  }
}

function formatMetricValue(
  value: number,
  metric: DistributionMetric,
  fmtCurrency?: (v: number) => string,
): string {
  if (metric === 'profit') {
    return fmtCurrency
      ? fmtCurrency(value)
      : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export default function PerformanceBarChart({
  positions,
  metric,
  onAssetSelect,
}: PerformanceBarChartProps) {
  const { format: formatCurrency } = useCurrency()

  const sorted = useMemo(() => {
    return [...positions]
      .map((pos) => ({ ...pos, metricValue: getMetricValue(pos, metric) }))
      .sort((a, b) => b.metricValue - a.metricValue)
  }, [positions, metric])

  const bars: AppDivergingBar[] = sorted.map((pos) => ({
    key: pos.asset_id,
    label: pos.ticker,
    value: pos.metricValue,
    display: formatMetricValue(pos.metricValue, metric, formatCurrency),
  }))

  const renderTooltip = (bar: AppDivergingBar) => {
    const pos = sorted.find((item) => item.asset_id === bar.key)
    if (!pos) return null

    return (
      <AppStack gap="xs">
        <AppText variant="caption" weight="strong">
          {pos.name || pos.ticker}
        </AppText>
        <AppText variant="caption">
          {METRIC_LABELS[metric]}: {bar.display}
        </AppText>
        <AppText variant="caption">Valor Atual: {formatCurrency(pos.value)}</AppText>
        <AppText variant="caption">Investido: {formatCurrency(pos.total_invested ?? 0)}</AppText>
      </AppStack>
    )
  }

  return (
    <AppDivergingBars bars={bars} onSelect={(key) => onAssetSelect?.(Number(key))} renderTooltip={renderTooltip} />
  )
}
