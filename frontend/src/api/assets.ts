import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { Asset } from '@/types'

export interface AssetTypeOption {
  id: number
  short_name: string
  asset_class_id?: number
}

export const fetchAssets = () => api.get<Asset[]>(ASSET_ROUTES.list).then((response) => response.data)
export const fetchAssetTypes = () =>
  api.get<AssetTypeOption[]>(ASSET_ROUTES.type).then((response) => response.data)
export const fetchAsset = (assetId: number) =>
  api.get<Asset>(ASSET_ROUTES.byId(assetId)).then((response) => response.data)
