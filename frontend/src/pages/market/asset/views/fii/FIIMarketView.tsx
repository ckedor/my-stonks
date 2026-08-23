import { fetchFIIProfile, type FIIProfile } from '@/api/market'
import { AppCard, AppSkeleton, AppStack, AppText } from '@/components/ui'
import { useEffect, useState } from 'react'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import FIIDividendsCard from './FIIDividendsCard'
import FIIIndicatorsCard from './FIIIndicatorsCard'

/** The market page of a real-estate fund.
 *
 *  The price chart first, then what only a fund has: the indicators it reports
 *  and the distributions it has paid. The profile loads after the chart rather
 *  than with it -- it comes from a different provider route and the chart must
 *  not wait on it, nor disappear if it fails.
 */
export default function FIIMarketView({
  assetId,
  ticker,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  const [profile, setProfile] = useState<FIIProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    setLoading(true)
    setFailed(false)
    fetchFIIProfile(assetId)
      .then((result) => current && setProfile(result))
      .catch(() => current && setFailed(true))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [assetId])

  return (
    <AppStack gap="md">
      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      {loading && <FIIProfileSkeleton />}

      {failed && (
        <AppCard>
          <AppText variant="bodySmall" tone="secondary">
            Não foi possível carregar os dados do fundo.
          </AppText>
        </AppCard>
      )}

      {profile?.indicators && <FIIIndicatorsCard indicators={profile.indicators} />}

      {/* Rendered whenever the profile loaded, empty list included. Hiding the
          card on an empty list made a provider that answered nothing look
          exactly like a page that was never built -- and the chart's own empty
          message, which says which of the two it is, could never be reached. */}
      {profile && <FIIDividendsCard dividends={profile.dividends} />}
    </AppStack>
  )
}

function FIIProfileSkeleton() {
  return (
    <AppStack gap="md">
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={180} height={28} />
          <AppSkeleton shape="text" width={320} height={22} />
          <AppSkeleton height={92} />
        </AppStack>
      </AppCard>
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={200} height={28} />
          <AppSkeleton height={280} />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
