import PortfolioMonthlyHeatmap from '@/components/PortfolioMonthlyHeatmap'
import PortfolioMonthlyReturnsChart from '@/components/PortfolioMonthlyReturnsChart'
import PortfolioReturnsChart from '@/components/PortfolioReturnsChart'
import PortfolioRolling12mChart from '@/components/PortfolioRolling12mChart'
import { AppCard, AppGrid, AppGridItem, AppStack, AppText, SectionTitle } from '@/components/ui'
import type { PortfolioReturnEntry, ReturnsEntry } from '@/types'
import { useMemo } from 'react'

interface Props {
  returns: PortfolioReturnEntry[]
  loading: boolean
  assetIds: number[]
}

export default function FIIReturnsTab({ returns, loading, assetIds }: Props) {
  const accumulated = useMemo<ReturnsEntry[]>(
    () => returns.map((entry) => ({ date: entry.date, value: entry.acc_return })),
    [returns],
  )
  const fiiSeries = useMemo(
    () => [{ key: 'fii', label: 'FIIs', data: accumulated, assetIds }],
    [accumulated, assetIds],
  )

  if (!loading && returns.length === 0) {
    return <AppText tone="secondary">Sem histórico de rentabilidade dos FIIs.</AppText>
  }

  return (
    <AppGrid cols={{ xs: 1, md: 2 }} gap="md">
      <AppGridItem span={{ xs: 1, md: 2 }}>
        <AppCard>
          <AppStack gap="md">
            <SectionTitle>Rentabilidade acumulada dos FIIs</SectionTitle>
            <PortfolioReturnsChart
              size={480}
              externalSeries={fiiSeries}
              selectedExternalSeries={['fii']}
              selectedBenchmarks={['IFIX', 'CDI']}
              externalLoading={loading}
              defaultRange="max"
              persistKey="fii-returns"
            />
          </AppStack>
        </AppCard>
      </AppGridItem>

      <AppGridItem span={{ xs: 1, md: 2 }}>
        <AppCard>
          <PortfolioMonthlyHeatmap data={accumulated} />
        </AppCard>
      </AppGridItem>

      <AppGridItem>
        <AppCard>
          <PortfolioMonthlyReturnsChart height={300} defaultRange="max" data={accumulated} />
        </AppCard>
      </AppGridItem>

      <AppGridItem>
        <AppCard>
          <PortfolioRolling12mChart height={300} data={accumulated} />
        </AppCard>
      </AppGridItem>
    </AppGrid>
  )
}
