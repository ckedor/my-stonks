import DrawdownChart from '@/components/DrawdownChart'
import BenchmarkComparison from '@/components/portfolio-asset/BenchmarkComparison'
import RiskMetricsPanel from '@/components/RiskMetricsPanel'
import { AppCard, AppStack, AppText, LoadingSpinner, SectionTitle } from '@/components/ui'
import type { AssetAnalysis } from '@/types'

interface Props {
  analysis: AssetAnalysis | null
  loading: boolean
}

/** Risco da categoria: as mesmas medidas da carteira, calculadas sobre a série
 *  diária da categoria pelo endpoint de análise dela. */
export default function CategoryRiskTab({ analysis, loading }: Props) {
  if (loading && !analysis) return <LoadingSpinner />

  if (!analysis) {
    return <AppText tone="secondary">Dados de análise não disponíveis para esta categoria.</AppText>
  }

  const benchmarks = analysis.performance_metrics.benchmarks_metrics

  return (
    <AppStack gap="lg">
      <RiskMetricsPanel analysis={analysis} />

      <DrawdownChart
        series={analysis.risk_metrics.drawdown.series}
        stats={analysis.risk_metrics.drawdown.stats}
        size={350}
      />

      {Object.keys(benchmarks).length > 0 && (
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
