import { useState } from 'react'

import {
  AppCard,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppSkeleton,
  AppStack,
  AppTabs,
  AppText,
} from '@/components/ui'
import { useEtfProfile } from '@/queries/etf'

import AssetDescriptionCard from '../../AssetDescriptionCard'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import EtfFundCard from './EtfFundCard'
import EtfHoldingsCard from '@/components/etf/EtfHoldingsCard'

type SectionId = 'holdings'

const SECTIONS: { id: SectionId; label: string }[] = [{ id: 'holdings', label: 'Carteira' }]

/** A tela de mercado de um ETF.
 *
 *  Em cima, o que o ETF é e o preço, lado a lado: o cadastro é o contexto e
 *  fica numa coluna estreita à esquerda, o gráfico é o assunto e leva o resto. Embaixo, atrás de
 *  abas como na tela de um fundo, o que ele publica — hoje a carteira.
 *
 *  Tudo vem do banco — o cadastro dos reguladores e a carteira do último
 *  informe —, nunca de um provedor na hora da leitura, e carrega depois do
 *  gráfico: o gráfico não pode esperar pelo cadastro nem sumir se ele falhar.
 */
export default function EtfMarketView({
  assetId,
  ticker,
  summary,
  description,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  const { profile, loading, failed } = useEtfProfile(assetId)
  const [section, setSection] = useState<SectionId>('holdings')

  return (
    <AppStack gap="md">
      {/* O cadastro à esquerda, estreito, e o gráfico com o resto da linha:
          o gráfico precisa de largura para ler tendência, o cadastro não. */}
      <AppGrid cols={{ xs: 1, lg: 4 }} gap="md" align="stretch">
        <AppGridItem>
          {loading ? (
            <AppSkeleton height="100%" />
          ) : failed || !profile ? (
            <AppCard height="100%">
              <AppText variant="bodySmall" tone="danger">
                Não foi possível carregar o cadastro deste ETF.
              </AppText>
            </AppCard>
          ) : (
            <EtfFundCard profile={profile} />
          )}
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 3 }}>
          <AssetQuoteCard
            data={candleData}
            persistKey={`market-asset:${ticker}`}
            priceFormatter={priceFormatter}
          />
        </AppGridItem>
      </AppGrid>

      <AssetDescriptionCard summary={summary} description={description} />

      {profile && (
        <AppStack gap="md">
          <AppStack gap="none">
            <AppDivider />
            <AppTabs
              items={SECTIONS}
              value={section}
              onChange={setSection}
              label="Seções do ETF"
            />
          </AppStack>
          {section === 'holdings' && <EtfHoldingsCard assetId={assetId} profile={profile} />}
        </AppStack>
      )}
    </AppStack>
  )
}
