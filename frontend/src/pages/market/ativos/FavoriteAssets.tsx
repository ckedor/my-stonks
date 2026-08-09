import { fetchFavoriteAssets, type FavoriteAsset } from '@/api/market'
import StarIcon from '@mui/icons-material/Star'
import { Box, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TypeBadge } from './AssetCard'

/** Assets the user keeps coming back to. Hidden entirely until there is a
 *  history to rank, so a new account sees no empty shelf. */
export default function FavoriteAssets({ limit = 8 }: { limit?: number }) {
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState<FavoriteAsset[]>([])

  useEffect(() => {
    let active = true
    fetchFavoriteAssets(limit)
      .then((data) => active && setFavorites(data))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [limit])

  if (!favorites.length) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.02em' }}>
          Mais acessados
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
        {favorites.map((asset) => (
          <Box
            key={asset.id}
            onClick={() => navigate(`/market/asset/${asset.id}`)}
            sx={{
              flexShrink: 0,
              minWidth: 150,
              px: 1.75,
              py: 1.25,
              cursor: 'pointer',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: 'border-color 150ms',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                {asset.ticker ?? asset.name}
              </Typography>
              {asset.asset_type?.short_name && (
                <TypeBadge label={asset.asset_type.short_name} />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {asset.visit_count} {asset.visit_count === 1 ? 'acesso' : 'acessos'}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
