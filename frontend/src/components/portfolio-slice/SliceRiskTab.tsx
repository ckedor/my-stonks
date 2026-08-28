import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import { AppText, LoadingSpinner } from '@/components/ui'
import type { AssetAnalysis } from '@/types'

interface Props {
  analysis: AssetAnalysis | null
  loading: boolean
}

/** Risco do recorte: as mesmas medidas da carteira, calculadas sobre a série
 *  diária dele. */
export default function SliceRiskTab({ analysis, loading }: Props) {
  if (loading && !analysis) return <LoadingSpinner />

  if (!analysis) {
    return <AppText tone="secondary">Dados de risco ainda não disponíveis para este recorte.</AppText>
  }

  return <RiskAnalysisCards analysis={analysis} showBenchmarks />
}
