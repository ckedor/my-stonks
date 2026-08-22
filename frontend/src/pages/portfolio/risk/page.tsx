import DrawdownChart from '@/components/DrawdownChart'
import { AppStack, AppText, LoadingSpinner, PageTitle } from '@/components/ui'
import { useAnalysisStore } from '@/stores/portfolio/analysis'
import RiskMetricsPanel from '@/components/RiskMetricsPanel'

export default function PortfolioRiskPage() {
  const { analysis, loading: analysisLoading } = useAnalysisStore()

  const loading = analysisLoading && !analysis

  if (loading) {
    return <LoadingSpinner />
  }

  if (!analysis) {
    return (
      <AppText tone="secondary">
        Dados de análise não disponíveis para esta carteira.
      </AppText>
    )
  }

  return (
    <AppStack gap="lg">
      <PageTitle>Risco</PageTitle>
      <RiskMetricsPanel analysis={analysis} />
      <DrawdownChart
        series={analysis.risk_metrics.drawdown.series}
        stats={analysis.risk_metrics.drawdown.stats}
        size={350}
      />
    </AppStack>
  )
}
