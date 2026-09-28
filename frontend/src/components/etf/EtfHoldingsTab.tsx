import { AppCard, AppSkeleton, AppText } from '@/components/ui'
import { useEtfProfile } from '@/queries/etf'

import EtfHoldingsCard from './EtfHoldingsCard'

/** A carteira do ETF numa aba de quem não tem o cadastro dele em mãos.
 *
 *  A visão de mercado já busca o cadastro para o cartão do fundo e entrega o
 *  mesmo ao cartão da carteira; a posição na carteira do usuário não tem esse
 *  cartão, e busca aqui só o que a aba precisa. A chave é a mesma, então quem
 *  passar pelas duas telas lê uma entrada só.
 */
export default function EtfHoldingsTab({ assetId }: { assetId: number }) {
  const { profile, loading, failed } = useEtfProfile(assetId)

  if (loading) return <AppSkeleton height={640} />
  if (failed || !profile) {
    return (
      <AppCard>
        <AppText variant="bodySmall" tone="danger">
          Não foi possível carregar a carteira deste ETF.
        </AppText>
      </AppCard>
    )
  }
  return <EtfHoldingsCard assetId={assetId} profile={profile} />
}
