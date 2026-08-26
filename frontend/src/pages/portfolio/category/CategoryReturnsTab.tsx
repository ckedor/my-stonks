import PortfolioMonthlyHeatmap from '@/components/PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from '@/components/PortfolioMonthlyReturnsChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import PortfolioRolling12mChart from '@/components/PortfolioRolling12mChart'
import { AppCard, AppGrid, AppGridItem, AppText } from '@/components/ui'
import type { ReturnsEntry } from '@/types'
import { useState } from 'react'

interface Props {
  /** Nome da categoria, que é como a série é encontrada no store. */
  category: string
  /** Série contra a qual a categoria é comparada. */
  benchmark: string
  returns: ReturnsEntry[]
}

/** A mesma leitura da rentabilidade da carteira, recortada para uma categoria:
 *  a curva contra o benchmark, o mapa mensal, os meses e a janela de 12 meses. */
export default function CategoryReturnsTab({ category, benchmark, returns }: Props) {
  const [range, setRange] = useState<string>('max')

  if (returns.length === 0) {
    return <AppText tone="secondary">Sem histórico de rentabilidade para esta categoria.</AppText>
  }

  return (
    <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
      <AppGridItem span={{ xs: 1, md: 2 }}>
        <AppCard>
          <PortfolioReturnsChart
            size={480}
            selectedCategory={category}
            selectedBenchmark={benchmark}
            defaultRange={range}
            onRangeChange={setRange}
            persistKey={`category-returns:${category}`}
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
