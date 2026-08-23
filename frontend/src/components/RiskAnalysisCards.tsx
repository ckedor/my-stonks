import DrawdownChart from '@/components/DrawdownChart'
import BenchmarkComparison from '@/components/portfolio-asset/BenchmarkComparison'
import RiskMetricsPanel from '@/components/RiskMetricsPanel'
import { AppCard, AppStack, SectionTitle } from '@/components/ui'
import type { AssetAnalysis } from '@/types'

interface Props {
  analysis: AssetAnalysis
  drawdownSize?: number
  showBenchmarks?: boolean
}

/** The standard visual frame for risk views across portfolio, category and asset pages. */
export default function RiskAnalysisCards({
  analysis,
  drawdownSize = 350,
  showBenchmarks = false,
}: Props) {
  const benchmarks = analysis.performance_metrics.benchmarks_metrics

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="md">
          <SectionTitle>Métricas de Risco</SectionTitle>
          <RiskMetricsPanel analysis={analysis} />
        </AppStack>
      </AppCard>

      <AppCard>
        <DrawdownChart
          series={analysis.risk_metrics.drawdown.series}
          stats={analysis.risk_metrics.drawdown.stats}
          size={drawdownSize}
        />
      </AppCard>

      {showBenchmarks && Object.keys(benchmarks).length > 0 && (
        <AppCard>
          <AppStack gap="md">
            <SectionTitle>Comparação com Benchmarks</SectionTitle>
            <BenchmarkComparison metrics={benchmarks} />
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}
