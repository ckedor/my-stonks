import { fetchFIIProfile, type FIIProfile } from '@/api/market'
import { AppCard, AppSkeleton, AppStack, AppText } from '@/components/ui'
import { useEffect, useState } from 'react'
import AssetQuoteCard from '../../AssetQuoteCard'
import type { AssetMarketViewProps } from '../types'
import FIICompositionCard from './FIICompositionCard'
import FIIDividendsCard from './FIIDividendsCard'
import FIIIndicatorsCard from './FIIIndicatorsCard'
import FIIIndicatorsHistoryCard from './FIIIndicatorsHistoryCard'
import FIIMonthlyReportCard from './FIIMonthlyReportCard'
import FIIPropertiesCard from './FIIPropertiesCard'

/** The market page of a real-estate fund.
 *
 *  The price chart first, then what only a fund has, in the order of how often
 *  the fund republishes it: the indicators and the payments, monthly; the
 *  filing behind them, monthly; what the fund holds and how empty its
 *  buildings are, quarterly and months late. Each section states the date it
 *  refers to, because they are not the same date.
 *
 *  The profile loads after the chart rather than with it — it comes from other
 *  provider routes and the chart must not wait on it, nor disappear if it
 *  fails. Each section is served independently too, so a provider route that
 *  is down costs its own card and leaves the rest of the page standing.
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

  const composition = profile?.composition

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

      {profile?.indicators && (
        <FIIIndicatorsCard indicators={profile.indicators} management={profile.management} />
      )}

      {profile && profile.indicators_history.length > 0 && (
        <FIIIndicatorsHistoryCard history={profile.indicators_history} />
      )}

      {/* Rendered whenever the profile loaded, empty list included. Hiding the
          card on an empty list made a provider that answered nothing look
          exactly like a page that was never built -- and the chart's own empty
          message, which says which of the two it is, could never be reached. */}
      {profile && <FIIDividendsCard dividends={profile.dividends} />}

      {profile?.monthly_report && <FIIMonthlyReportCard report={profile.monthly_report} />}

      {composition && (
        <FIICompositionCard
          composition={composition}
          history={profile?.composition_history ?? []}
        />
      )}

      {/* The buildings and their history are one subject and one card, even
          though they come from two filings: a vacancy of 3% says nothing until
          the reader can see it against the quarters before it. So the card
          shows whenever either half arrived. */}
      {profile && (composition?.properties.length || profile.properties_history.length > 0) && (
        <FIIPropertiesCard
          properties={composition?.properties ?? []}
          summary={composition?.summary?.properties ?? null}
          referenceDate={composition?.reference_date ?? null}
          history={profile.properties_history}
        />
      )}
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
          <AppSkeleton height={260} />
        </AppStack>
      </AppCard>
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={200} height={28} />
          <AppSkeleton height={280} />
        </AppStack>
      </AppCard>
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={180} height={28} />
          <AppSkeleton height={92} />
          <AppSkeleton height={200} />
        </AppStack>
      </AppCard>
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={220} height={28} />
          <AppSkeleton height={92} />
          <AppSkeleton height={260} />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
