import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import RiskAnalysisCardsSkeleton from '@/components/RiskAnalysisCardsSkeleton'
import { AppText } from '@/components/ui'
import type { AssetAnalysis } from '@/types'

interface Props {
  analysis: AssetAnalysis | null
  loading: boolean
}

/** Risco da categoria: as mesmas medidas da carteira, calculadas sobre a série
 *  diária da categoria pelo endpoint de análise dela. */
export default function CategoryRiskTab({ analysis, loading }: Props) {
  if (loading && !analysis) return <RiskAnalysisCardsSkeleton />

  if (!analysis) {
    return <AppText tone="secondary">Dados de análise não disponíveis para esta categoria.</AppText>
  }

  return <RiskAnalysisCards analysis={analysis} showBenchmarks />
}
