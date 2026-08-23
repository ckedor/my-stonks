import {
  fetchAssetQuoteHistory,
  fetchMarketAssetDetails,
  quotesToCandleData,
  type AssetQuoteHistory,
  type MarketAssetDetails,
} from '@/api/market'
import AssetHeader from '@/components/asset/AssetHeader'
import AssetPositionCard from '@/components/asset/AssetPositionCard'
import { AppBreadcrumbs, AppStack, AppText } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { QUOTE_CHART_HEIGHT } from './AssetQuoteCard'
import MarketAssetSkeleton from './MarketAssetSkeleton'
import { assetMarketView } from './views'
import { useFavoritesStore } from '@/stores/favorites'
import { useMarketStore } from '@/stores/market'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function MarketAssetPage() {
  const { id } = useParams<{ id: string }>()
  const { assets } = useMarketStore()
  const { currency, format } = useCurrency()
  const recordVisit = useFavoritesStore((state) => state.recordVisit)

  const storedAsset = useMemo(() => assets.find((a) => a.id === Number(id)), [assets, id])
  const [fetchedAsset, setFetchedAsset] = useState<MarketAssetDetails | null>(null)
  const [assetLoading, setAssetLoading] = useState(!storedAsset)
  const [quotes, setQuotes] = useState<AssetQuoteHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const asset = storedAsset ?? fetchedAsset

  useEffect(() => {
    if (storedAsset || !id) {
      setAssetLoading(false)
      return
    }

    let active = true
    setAssetLoading(true)
    fetchMarketAssetDetails(Number(id))
      .then((value) => {
        if (active) setFetchedAsset(value)
      })
      .catch(() => {
        if (active) setError('Ativo não encontrado')
      })
      .finally(() => {
        if (active) setAssetLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, storedAsset])

  const ticker = asset?.ticker

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

  const candleData = useMemo(() => (quotes ? quotesToCandleData(quotes.quotes) : []), [quotes])

  // What this asset's type has to show. Everything below the header varies
  // with it; the header itself does not.
  const AssetMarketView = assetMarketView(asset?.asset_type_id)

  if (assetLoading || (loading && asset)) {
    return <MarketAssetSkeleton height={QUOTE_CHART_HEIGHT} />
  }

  return (
    <AppStack gap="md">
      <AppBreadcrumbs
        items={[{ label: 'Mercado', href: '/market/assets' }, { label: ticker ?? '' }]}
      />

      <AssetHeader
        ticker={ticker ?? ''}
        name={asset?.name}
        typeShortName={asset?.asset_type?.short_name}
        logoUrl={quotes?.logo_url}
        // Vem em fração desta ponta da API, ao contrário da análise da
        // posição; o header trabalha sempre em pontos percentuais.
        cagr={
          quotes?.cagr
            ? { value: quotes.cagr.value * 100, startDate: quotes.cagr.start_date }
            : null
        }
        cagrHint="Calculado sobre o fechamento ajustado por proventos e desdobramentos"
        action={
          asset && (
            <AssetPositionCard
              assetId={asset.id}
              ticker={asset.ticker ?? ''}
              name={asset.name}
              assetTypeId={asset.asset_type_id}
            />
          )
        }
      />

      {error || !asset ? (
        <AppText tone="danger">{error ?? 'Ativo não encontrado'}</AppText>
      ) : (
        <AssetMarketView
          assetId={asset.id}
          ticker={asset.ticker ?? ''}
          candleData={candleData}
          priceFormatter={format}
        />
      )}
    </AppStack>
  )
}
