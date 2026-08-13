import { fetchFIIProfile, type FIIProfile } from '@/api/market'
import AppCard from '@/components/ui/AppCard'
import { Skeleton, Stack, Typography } from '@mui/material'
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
    <Stack spacing={2}>
      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      {loading && <FIIProfileSkeleton />}

      {failed && (
        <AppCard>
          <Typography variant="body2" color="text.secondary">
            Não foi possível carregar os dados do fundo.
          </Typography>
        </AppCard>
      )}

      {profile?.indicators && <FIIIndicatorsCard indicators={profile.indicators} />}
      {profile && profile.dividends.length > 0 && (
        <FIIDividendsCard dividends={profile.dividends} />
      )}
    </Stack>
  )
}

function FIIProfileSkeleton() {
  return (
    <Stack spacing={2}>
      <AppCard>
        <Skeleton variant="text" width={180} height={28} />
        <Skeleton variant="text" width="60%" height={22} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" width="100%" height={92} />
      </AppCard>
      <AppCard>
        <Skeleton variant="text" width={200} height={28} sx={{ mb: 1.5 }} />
        <Skeleton variant="rounded" width="100%" height={280} />
      </AppCard>
    </Stack>
  )
}
