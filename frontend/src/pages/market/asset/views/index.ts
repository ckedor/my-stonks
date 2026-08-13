import { ASSET_TYPES } from '@/constants/assetTypes'
import type { ComponentType } from 'react'
import DefaultAssetMarketView from './DefaultAssetMarketView'
import FIIMarketView from './fii/FIIMarketView'
import type { AssetMarketViewProps } from './types'

/** Which market view an asset type gets.
 *
 *  A type is registered here only once it has something of its own to show; a
 *  stock and a cryptoasset are answered by the same price chart today and there
 *  is nothing to gain from giving each an identical file. Adding a type means
 *  adding its component and one line here -- the page itself does not branch on
 *  asset types.
 */
const VIEWS: Partial<Record<number, ComponentType<AssetMarketViewProps>>> = {
  [ASSET_TYPES.FII]: FIIMarketView,
}

export function assetMarketView(assetTypeId: number | undefined) {
  return (assetTypeId && VIEWS[assetTypeId]) || DefaultAssetMarketView
}

export type { AssetMarketViewProps }
