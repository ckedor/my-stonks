import type { PortfolioPositionEntry } from '@/types'
import { scaleLinear } from '@visx/scale'

import type { DistributionMetric } from './PerformanceBarChart'

/* Extremos da escala de cor, por métrica. Um lucro de cem mil e uma
   rentabilidade de 30% são o mesmo verde: é o teto de cada uma. O mapa 2D e a
   cidade pintam com a mesma escala, então a mesma cor diz a mesma coisa. */
const COLOR_DOMAIN: Record<DistributionMetric, number[]> = {
  profit: [-50000, 0, 100000],
  cagr: [-0.2, 0, 0.3],
  twelve_months_return: [-0.2, 0, 0.3],
  acc_return: [-0.2, 0, 0.3],
}

/** Vermelho, cinza e verde de toda escala de variação: o mapa do mercado
 *  pinta com as mesmas três, para a mesma cor dizer a mesma coisa. */
export const COLOR_RANGE = ['rgb(206, 43, 43)', 'rgb(117, 117, 117)', 'rgb(39, 174, 96)']

export function metricColorScale(metric: DistributionMetric) {
  return scaleLinear<string>({ domain: COLOR_DOMAIN[metric], range: COLOR_RANGE, clamp: true })
}

export function getMetricValue(pos: PortfolioPositionEntry, metric: DistributionMetric): number {
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

export function formatMetricDisplay(
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
