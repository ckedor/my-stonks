import {
  fetchAssetQuoteHistory,
  quotesToCandleData,
  type AssetQuoteHistory,
} from '@/api/market'
import { useCurrency } from '@/hooks/useCurrency'
import AssetHeaderStats from './AssetHeaderStats'
import { QUOTE_CHART_HEIGHT } from './AssetQuoteCard'
import MarketAssetSkeleton from './MarketAssetSkeleton'
import { assetMarketView } from './views'
import { useFavoritesStore } from '@/stores/favorites'
import { useMarketStore } from '@/stores/market'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

export default function MarketAssetPage() {
  const { id } = useParams<{ id: string }>()
  const { assets } = useMarketStore()
  const { currency, format } = useCurrency()
  const recordVisit = useFavoritesStore((state) => state.recordVisit)

  const asset = useMemo(
    () => assets.find((a) => a.id === Number(id)),
    [assets, id],
  )

  const ticker = asset?.ticker

  const [quotes, setQuotes] = useState<AssetQuoteHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    if (!asset) return
    setLoading(true)
    setError(null)
    setLogoFailed(false)
    // Opening an asset is what ranks it among the user's favourites.
    recordVisit(asset.id)
    // The quotes are converted server-side, so switching the global currency
    // refetches rather than rescaling what is already on screen.
    fetchAssetQuoteHistory(asset.id, undefined, currency)
      .then(setQuotes)
      .catch(() => setError('Erro ao carregar cotações'))
      .finally(() => setLoading(false))
  }, [asset, currency, recordVisit])

  const candleData = useMemo(
    () => (quotes ? quotesToCandleData(quotes.quotes) : []),
    [quotes],
  )

  // What this asset's type has to show. Everything below the header varies
  // with it; the header itself does not.
  const AssetMarketView = assetMarketView(asset?.asset_type_id)

  if (loading) return <MarketAssetSkeleton height={QUOTE_CHART_HEIGHT} />

  return (
    <Box pt={2}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
        <MuiLink component={Link} to="/market/assets" underline="hover" color="text.secondary">
          Mercado
        </MuiLink>
        <Typography color="text.primary">{ticker}</Typography>
      </Breadcrumbs>

      <Box display="flex" alignItems="center" gap={1.25} mb={0.5}>
        {quotes?.logo_url && !logoFailed && (
          <Box
            component="img"
            src={quotes.logo_url}
            alt=""
            // The provider advertises a logo for tickers it has no artwork for
            // and the URL 404s, so the image itself is the only reliable signal.
            onError={() => setLogoFailed(true)}
            sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'contain' }}
          />
        )}
        <Typography variant="h5" fontWeight="bold">
          {ticker}
        </Typography>
        {asset?.asset_type?.short_name && (
          <Typography
            component="span"
            sx={{
              color: 'text.secondary',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: 0,
              borderRadius: 1,
              bgcolor: 'action.hover',
              px: 0.75,
              py: 0.25,
            }}
          >
            {asset.asset_type.short_name}
          </Typography>
        )}
      </Box>
      <Box mb={2}>
        {asset && (
          <Typography variant="body1" color="text.secondary">
            {asset.name}
          </Typography>
        )}
        <AssetHeaderStats cagr={quotes?.cagr ?? null} />
      </Box>

      {error || !asset ? (
        <Typography color="error">{error ?? 'Ativo não encontrado'}</Typography>
      ) : (
        <AssetMarketView
          assetId={asset.id}
          ticker={asset.ticker}
          candleData={candleData}
          priceFormatter={format}
        />
      )}
    </Box>
  )
}
