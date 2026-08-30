import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AssetType {
  id: number
  short_name: string
  name: string
  asset_class_id: number
  asset_class: {
    id: number
    name: string
  }
}

interface MarketAsset {
  id: number
  ticker: string
  name: string
  /** URL do logo, guardada no cadastro pela sincronização com o catálogo. */
  logo_url?: string | null
  asset_type_id: number
  asset_type: AssetType
}

interface MarketState {
  assets: MarketAsset[]
  assetTypes: AssetType[]
  loading: boolean
  setAssets: (assets: MarketAsset[]) => void
  setAssetTypes: (types: AssetType[]) => void
  setLoading: (loading: boolean) => void
}

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      assets: [],
      assetTypes: [],
      loading: false,
      setAssets: (assets) => set({ assets }),
      setAssetTypes: (types) => set({ assetTypes: types }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'market-store',
      partialize: (state) => ({
        assets: state.assets,
        assetTypes: state.assetTypes,
      }),
    },
  ),
)
