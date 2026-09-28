import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MarketCatalogueAsset } from '@/api/market'
import { AppAssetLogo, AppListRow, AppStack, AppStackItem, AppText } from '@/components/ui'

/** Uma linha de papel nas listas curtas da tela: logo, ticker e nome, e à
 *  direita o número que a lista mede. Abre a tela do ativo quando o cadastro
 *  o conhece. */
export default function MarketAssetRow({
  asset,
  leading,
  trailing,
}: {
  asset: MarketCatalogueAsset
  /** Antes do logo: a posição num ranking. */
  leading?: ReactNode
  trailing: ReactNode
}) {
  const navigate = useNavigate()
  const open =
    asset.asset_id != null ? () => navigate(`/market/asset/${asset.asset_id}`) : undefined
  return (
    <AppListRow padding="sm" onClick={open}>
      <AppStack direction="row" gap="sm" align="center" grow>
        {leading}
        <AppAssetLogo src={asset.logo_url} size={22} reserve />
        <AppStackItem minWidth={0}>
          <AppStack gap="none">
            <AppText variant="bodySmall" weight="strong" noWrap>
              {asset.ticker}
            </AppText>
            <AppText variant="caption" tone="secondary" noWrap>
              {asset.name}
            </AppText>
          </AppStack>
        </AppStackItem>
        {trailing}
      </AppStack>
    </AppListRow>
  )
}
