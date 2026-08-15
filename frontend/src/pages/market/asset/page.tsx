import {
  fetchAssetQuoteHistory,
  quotesToCandleData,
  type AssetQuoteHistory,
} from '@/api/market'
import AssetHeader from '@/components/asset/AssetHeader'
import AssetPositionCard from '@/components/asset/AssetPositionCard'
import AppBreadcrumbs from '@/components/ui/AppBreadcrumbs'
import { useCurrency } from '@/hooks/useCurrency'
import { QUOTE_CHART_HEIGHT } from './AssetQuoteCard'
import MarketAssetSkeleton from './MarketAssetSkeleton'
import { assetMarketView } from './views'
import { useFavoritesStore } from '@/stores/favorites'
import { useMarketStore } from '@/stores/market'
import { Box, Typography } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

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

  useEffect(() => {
    if (!asset) return
    setLoading(true)
    setError(null)
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
      <AppBreadcrumbs items={[{ label: 'Mercado', href: '/market/assets' }, { label: ticker ?? '' }]} />

      <Box mb={2}>
        <AssetHeader
          ticker={ticker ?? ''}
          name={asset?.name}
          typeShortName={asset?.asset_type?.short_name}
          logoUrl={quotes?.logo_url}
          // Vem em fração desta ponta da API, ao contrário da análise da
          // posição; o header trabalha sempre em pontos percentuais.
          cagr={quotes?.cagr ? { value: quotes.cagr.value * 100, startDate: quotes.cagr.start_date } : null}
          cagrHint="Calculado sobre o fechamento ajustado por proventos e desdobramentos"
          action={
            asset && (
              <AssetPositionCard
                assetId={asset.id}
                ticker={asset.ticker}
                name={asset.name}
                assetTypeId={asset.asset_type_id}
              />
            )
          }
        />
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
