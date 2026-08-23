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
export default function FavoriteAssets({
  limit = 8,
  assetTypeId,
  assetIds,
}: {
  limit?: number
  assetTypeId?: number
  /** Limits the ranking to the universe represented by the current page. */
  assetIds?: number[]
}) {
  const navigate = useNavigate()
  const { favorites, refresh } = useFavoritesStore()
  const [filteredFavorites, setFilteredFavorites] = useState<FavoriteAsset[]>([])

  useEffect(() => {
    if (assetTypeId == null && assetIds == null) {
      void refresh()
      return
    }
    if (assetIds?.length === 0) {
      setFilteredFavorites([])
      return
    }
    void fetchFavoriteAssets(limit, assetTypeId, assetIds)
      .then(setFilteredFavorites)
      .catch(() => undefined)
  }, [refresh, limit, assetTypeId, assetIds])

  const visibleFavorites = assetTypeId == null && assetIds == null
    ? favorites
    : filteredFavorites

  if (!visibleFavorites.length) return null

  return (
    <AppStack gap="sm">
      <AppStack direction="row" gap="xs" align="center">
        <StarIcon color="warning" fontSize="small" />
        <SectionLabel>Mais acessados</SectionLabel>
      </AppStack>

      <AppStack direction="row" gap="sm" scrollX>
        {visibleFavorites.slice(0, limit).map((asset) => (
          <AppCard
            key={asset.id}
            padding="sm"
            interactive
            minWidth={150}
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
