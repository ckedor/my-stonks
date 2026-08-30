import { ASSET_TYPES } from '@/constants/assetTypes'
import type { ComponentType } from 'react'
import DefaultAssetMarketView from './DefaultAssetMarketView'
import FIIMarketView from './fii/FIIMarketView'
import InvestmentFundMarketView from './investment-fund/InvestmentFundMarketView'
import StockMarketView from './stock/StockMarketView'
import type { AssetMarketViewProps } from './types'

/** Which market view an asset type gets.
 *
 *  A type is registered here only once it has something of its own to show; a
 *  cryptoasset is answered by the price chart alone today and there is nothing
 *  to gain from giving it an identical file. Adding a type means adding its
 *  component and one line here -- the page itself does not branch on asset
 *  types.
 *
 *  A BDR is served by the same provider routes as a stock and would take one
 *  more line, but it is left out on purpose: the fundamentals behind a BDR are
 *  a foreign company's, not those of the certificate traded here, and showing
 *  them under a Brazilian ticker would say something untrue.
 */
const VIEWS: Partial<Record<number, ComponentType<AssetMarketViewProps>>> = {
  [ASSET_TYPES.FII]: FIIMarketView,
  [ASSET_TYPES.FI]: InvestmentFundMarketView,
  [ASSET_TYPES.STOCK]: StockMarketView,
}

export function assetMarketView(assetTypeId: number | undefined) {
  return (assetTypeId && VIEWS[assetTypeId]) || DefaultAssetMarketView
}

export type { AssetMarketViewProps }
