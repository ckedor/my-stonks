import AssetQuoteCard from '../AssetQuoteCard'
import type { AssetMarketViewProps } from './types'

/** What an asset shows when its type has nothing of its own to say yet.
 *
 *  The price chart alone, which is what the market page showed for every type
 *  before any of them grew a view. */
export default function DefaultAssetMarketView({
  ticker,
  candleData,
  priceFormatter,
}: AssetMarketViewProps) {
  return (
    <AssetQuoteCard
      data={candleData}
      persistKey={`market-asset:${ticker}`}
      priceFormatter={priceFormatter}
    />
  )
}
