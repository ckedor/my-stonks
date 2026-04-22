import { fetchAssetQuotes, quotesToCandleData, type QuoteResponse } from '@/api/market'
import CandleChart from '@/components/charts/CandleChart'
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useMarketStore } from '@/stores/market'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { Box, Breadcrumbs, Chip, Grid, Link as MuiLink, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AssetAIOverviewCard from './AssetAIOverviewCard'

const ASSET_TYPE_MAP: Record<number, string> = {
  1: 'ETF',
  2: 'FII',
  3: 'TREASURY',
  4: 'STOCK',
  5: 'BDR',
  6: 'PREV',
  7: 'FI',
  8: 'CDB',
  9: 'DEB',
  10: 'CRI',
  11: 'CRA',
  12: 'REIT',
  13: 'CRIPTO',
  14: 'LCA',
}

export default function MarketAssetPage() {
  const { id } = useParams<{ id: string }>()
  const { assets } = useMarketStore()

  const asset = useMemo(
    () => assets.find((a) => a.id === Number(id)),
    [assets, id],
  )

  const ticker = asset?.ticker

  const [quotes, setQuotes] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!asset) return
    const assetType = ASSET_TYPE_MAP[asset.asset_type_id]
    setLoading(true)
    setError(null)
    fetchAssetQuotes(asset.ticker, assetType)
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

      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <Typography variant="h5" fontWeight="bold">
          {ticker}
        </Typography>
        {asset && (
          <Chip
            label={asset.asset_type?.short_name}
            size="small"
            variant="outlined"
          />
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
        <Grid container spacing={2} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 9 }}>
            <AppCard title="Cotação">
              <CandleChart
                data={candleData}
                height={500}
                showVolume
                showVolumeToggle
                showRangePicker
                showTimeframeSelector
                defaultRange="1y"
              />
            </AppCard>
          </Grid>
          {ticker && (
            <Grid size={{ xs: 12, lg: 3 }}>
              <AssetAIOverviewCard ticker={ticker} />
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  )
}
