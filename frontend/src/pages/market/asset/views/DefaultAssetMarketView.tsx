import AssetDescriptionCard from '../AssetDescriptionCard'
import AssetQuoteCard from '../AssetQuoteCard'
import type { AssetMarketViewProps } from './types'

import { AppStack } from '@/components/ui'

/** What an asset shows when its type has nothing of its own to say yet.
 *
 *  The price chart, and the description of what the thing is. A cryptoasset, a
 *  BDR or a Treasury bond has no provider profile behind it, so this is the
 *  only page they get — which is exactly where saying what an instrument is
 *  earns the most, and why the description is not reserved for the types that
 *  already have a view of their own. */
export default function DefaultAssetMarketView({
  ticker,
  summary,
  description,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  return (
    <AppStack gap="md">
      <AssetQuoteCard
        data={candleData}
        persistKey={`market-asset:${ticker}`}
        priceFormatter={priceFormatter}
      />

      <AssetDescriptionCard summary={summary} description={description} />
    </AppStack>
  )
}
