import { useEffect, useMemo } from 'react'
import type { MarketCatalogueAsset } from '@/api/market'
import { AppCard, AppGrid, AppStack, AppText, SectionTitle } from '@/components/ui'
import { money } from '@/components/market-catalogue/format'
import { useFavoritesStore } from '@/stores/favorites'
import AssetChange from './AssetChange'
import { TypeBadge } from './AssetCard'
import MarketAssetRow from './MarketAssetRow'

/** Os papéis que você mais abre, em largura cheia no topo da tela, com as
 *  linhas em duas colunas: com o preço e o dia quando o catálogo tem, e o tipo quando
 *  não tem — renda fixa, fundo e o que é de fora não aparecem nele. */
export default function RecentAssets({
  market,
  limit = 10,
}: {
  market: MarketCatalogueAsset[]
  limit?: number
}) {
  const { favorites, refresh } = useFavoritesStore()
  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(() => {
    const byId = new Map(
      market.filter((asset) => asset.asset_id != null).map((asset) => [asset.asset_id!, asset])
    )
    return favorites.slice(0, limit).map((favorite) => ({
      favorite,
      asset:
        byId.get(favorite.id) ??
        ({
          asset_id: favorite.id,
          ticker: favorite.ticker ?? favorite.name,
          name: favorite.name,
          price: null,
          change_percent: null,
          volume: null,
          market_cap: null,
          currency: 'BRL',
          logo_url: favorite.logo_url,
          sector: null,
          subsector: null,
        } satisfies MarketCatalogueAsset),
    }))
  }, [favorites, market, limit])

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack gap="none">
          <SectionTitle>Acessados recentemente</SectionTitle>
          <AppText variant="caption" tone="secondary">
            Os ativos que você mais abre
          </AppText>
        </AppStack>
        {rows.length === 0 ? (
          <AppText variant="bodySmall" tone="secondary">
            Os ativos que você abrir aparecem aqui.
          </AppText>
        ) : (
          <AppGrid cols={{ xs: 1, md: 2 }} gap="lg">
            {rows.map(({ favorite, asset }) => (
              <MarketAssetRow
                key={favorite.id}
                asset={asset}
                trailing={
                  asset.price == null ? (
                    <TypeBadge label={favorite.asset_type.short_name} />
                  ) : (
                    <AppStack gap="none" align="end">
                      <AppText variant="bodySmall" noWrap>
                        {money(asset.price, asset.currency)}
                      </AppText>
                      <AssetChange value={asset.change_percent} />
                    </AppStack>
                  )
                }
              />
            ))}
          </AppGrid>
        )}
      </AppStack>
    </AppCard>
  )
}
