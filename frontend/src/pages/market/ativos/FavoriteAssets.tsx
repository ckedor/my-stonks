import { fetchFavoriteAssets, type FavoriteAsset } from '@/api/market'
import { useFavoritesStore } from '@/stores/favorites'
import { AppCard, AppStack, AppText, SectionLabel } from '@/components/ui'
import StarIcon from '@mui/icons-material/Star'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TypeBadge } from './AssetCard'

/** Assets the user keeps coming back to. Rendered from the store, so it is
 *  there the moment the page is, and refreshed behind what is on screen.
 *  Hidden entirely until there is a history to rank, so a new account sees no
 *  empty shelf. */
/** Passo fixo da prateleira. Com largura livre, um nome comprido esticava o
 *  seu card e a fileira ficava com cards de tamanhos diferentes — o olho lê
 *  isso como desalinhamento, não como conteúdo. */
const FAVORITE_CARD_WIDTH = 190

export default function FavoriteAssets({
  limit = 8,
  assetTypeId,
  assetIds,
  brazilian,
  orientation = 'row',
}: {
  limit?: number
  assetTypeId?: number
  /** Limits the ranking to the universe represented by the current page. */
  assetIds?: number[]
  /** O lado da fronteira que a tela mostra — o que separa o ETF da B3 do ETF
   *  americano, que têm o mesmo tipo de ativo. */
  brazilian?: boolean
  /** Na coluna de navegação a prateleira empilha e ocupa a largura da coluna;
   *  na página ela é uma fileira que rola. */
  orientation?: 'row' | 'column'
}) {
  const navigate = useNavigate()
  const { favorites, refresh } = useFavoritesStore()
  const [filteredFavorites, setFilteredFavorites] = useState<FavoriteAsset[]>([])

  useEffect(() => {
    if (assetTypeId == null && assetIds == null && brazilian == null) {
      void refresh()
      return
    }
    if (assetIds?.length === 0) {
      setFilteredFavorites([])
      return
    }
    void fetchFavoriteAssets(limit, assetTypeId, assetIds, brazilian)
      .then(setFilteredFavorites)
      .catch(() => undefined)
  }, [refresh, limit, assetTypeId, assetIds, brazilian])

  const visibleFavorites = assetTypeId == null && assetIds == null && brazilian == null
    ? favorites
    : filteredFavorites

  if (!visibleFavorites.length) return null

  return (
    <AppStack gap="sm">
      <AppStack direction="row" gap="xs" align="center">
        <StarIcon color="warning" fontSize="small" />
        <SectionLabel>Acessados recentemente</SectionLabel>
      </AppStack>

      <AppStack
        direction={orientation}
        gap="sm"
        scrollX={orientation === 'row'}
      >
        {visibleFavorites.slice(0, limit).map((asset) => (
          <AppCard
            key={asset.id}
            padding="sm"
            interactive
            width={orientation === 'row' ? FAVORITE_CARD_WIDTH : undefined}
            onClick={() => navigate(`/market/asset/${asset.id}`)}
          >
            <AppStack gap="none">
              <AppStack direction="row" gap="sm" align="center">
                <AppText weight="strong" noWrap>
                  {asset.ticker ?? asset.name}
                </AppText>
                {asset.asset_type?.short_name && (
                  <TypeBadge label={asset.asset_type.short_name} />
                )}
              </AppStack>
              {/* The visit count only ranks the shelf -- showing it tells the
                  user about our bookkeeping, not about the asset. */}
              <AppText variant="caption" tone="secondary" noWrap>
                {asset.name}
              </AppText>
            </AppStack>
          </AppCard>
        ))}
      </AppStack>
    </AppStack>
  )
}
