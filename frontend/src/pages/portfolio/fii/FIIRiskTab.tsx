import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import RiskAnalysisCardsSkeleton from '@/components/RiskAnalysisCardsSkeleton'
import { AppText } from '@/components/ui'
import type { AssetAnalysis } from '@/types'

interface Props {
  analysis: AssetAnalysis | null
  loading: boolean
}

export default function FIIRiskTab({ analysis, loading }: Props) {
  if (loading && !analysis) return <RiskAnalysisCardsSkeleton />
  if (!analysis) return <AppText tone="secondary">Dados de risco dos FIIs ainda não disponíveis.</AppText>

  return <RiskAnalysisCards analysis={analysis} showBenchmarks />
}
