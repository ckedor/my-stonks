import PortfolioMonthlyHeatmap from '@/components/PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from '@/components/PortfolioMonthlyReturnsChart'
import PortfolioReturnsChart, {
  type ReturnsChartExternalSeries,
} from '@/components/PortfolioReturnsChart'
import PortfolioRolling12mChart from '@/components/PortfolioRolling12mChart'
import { AppCard, AppGrid, AppGridItem, AppText } from '@/components/ui'
import type { ReturnsEntry } from '@/types'
import { useState } from 'react'

interface Props {
  /** Rentabilidade acumulada do recorte, ponto a ponto. */
  returns: ReturnsEntry[]
  loading?: boolean
  /** Séries contra as quais o recorte se compara. */
  benchmarks: string[]
  /** Quando a série já vive no store sob o nome de uma categoria. */
  categoryName?: string
  /** Quando ela vem de fora do store — o caso dos segmentos. */
  externalSeries?: ReturnsChartExternalSeries
  persistKey: string
}

/** A rentabilidade de um recorte: a curva contra os benchmarks, o mapa mensal,
 *  os meses e a janela de 12 meses. É a mesma leitura da carteira inteira,
 *  sobre um pedaço dela. */
export default function SliceReturnsTab({
  returns,
  loading = false,
  benchmarks,
  categoryName,
  externalSeries,
  persistKey,
}: Props) {
  const [range, setRange] = useState<string>('max')

  if (!loading && returns.length === 0) {
    return <AppText tone="secondary">Sem histórico de rentabilidade para este recorte.</AppText>
  }

  return (
    <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
      <AppGridItem span={{ xs: 1, md: 2 }}>
        <AppCard>
          <PortfolioReturnsChart
            size={480}
            selectedCategory={categoryName}
            selectedBenchmarks={benchmarks}
            externalSeries={externalSeries ? [externalSeries] : undefined}
            selectedExternalSeries={externalSeries ? [externalSeries.key] : undefined}
            externalLoading={loading}
            defaultRange={range}
            onRangeChange={setRange}
            persistKey={persistKey}
          />
        </AppCard>
      </AppGridItem>

      <AppGridItem span={{ xs: 1, md: 2 }}>
        <AppCard>
          <PortfolioMonthlyHeatmap data={returns} />
        </AppCard>
      </AppGridItem>

      <AppGridItem>
        <AppCard>
          <PortfolioMonthlyReturnsChart height={300} defaultRange={range} data={returns} />
        </AppCard>
      </AppGridItem>

      <AppGridItem>
        <AppCard>
          <PortfolioRolling12mChart height={300} data={returns} />
        </AppCard>
      </AppGridItem>
    </AppGrid>
  )
}
