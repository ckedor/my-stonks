import {
  fetchAssetQuoteHistory,
  quotesToCandleData,
  recordAssetVisit,
  type AssetQuoteHistory,
} from '@/api/market'
import CandleChart from '@/components/charts/CandleChart'
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useMarketStore } from '@/stores/market'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { Box, Breadcrumbs, Link as MuiLink, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

export default function MarketAssetPage() {
  const { id } = useParams<{ id: string }>()
  const { assets } = useMarketStore()

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
    recordAssetVisit(asset.id)
    fetchAssetQuoteHistory(asset.id)
      .then(setQuotes)
      .catch(() => setError('Erro ao carregar cotações'))
      .finally(() => setLoading(false))
  }, [asset])

  const candleData = useMemo(
    () => (quotes ? quotesToCandleData(quotes.quotes) : []),
    [quotes],
  )

  if (loading) return <LoadingSpinner />

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
      {asset && (
        <Typography variant="body1" color="text.secondary" mb={2}>
          {asset.name}
        </Typography>
      )}

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <AppCard title="Cotação">
          <CandleChart
            data={candleData}
            height={500}
            showVolume
            showVolumeToggle
            showRangePicker
            showTimeframeSelector
            showTypeToggle
            showLogToggle
            showMovingAverageToggle
            showPerformance
            defaultRange="1y"
            persistKey={`market-asset:${ticker}`}
          />
        </AppCard>
      )}
    </Box>
  )
}
