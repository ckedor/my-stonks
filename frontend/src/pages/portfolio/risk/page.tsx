import { useAnalysis } from '@/queries/portfolio'
import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import RiskAnalysisCardsSkeleton from '@/components/RiskAnalysisCardsSkeleton'
import { AppPageHeader, AppPageHeaderSkeleton, AppStack, AppText } from '@/components/ui'

export default function PortfolioRiskPage() {
  const { data: analysis, isPending: analysisLoading } = useAnalysis()

  const loading = analysisLoading && !analysis

  if (loading) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={120} />
        <RiskAnalysisCardsSkeleton />
      </AppStack>
    )
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
      <AppPageHeader
        title="Risco"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Risco' },
        ]}
      />

      <RiskAnalysisCards analysis={analysis} />
    </AppStack>
  )
}
