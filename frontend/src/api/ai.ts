import { AI_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

export interface AIFeature {
  id: number
  key: string
  default_ttl_hours: number
  created_at: string
  updated_at: string
}

export interface AIFeatureUpdate {
  default_ttl_hours?: number
}

export const fetchAIFeatures = (): Promise<AIFeature[]> =>
  api.get<AIFeature[]>(AI_ROUTES.feature).then((r) => r.data)

export const updateAIFeature = (id: number, data: AIFeatureUpdate): Promise<AIFeature> =>
  api.patch<AIFeature>(AI_ROUTES.featureById(id), data).then((r) => r.data)

export interface AssetOverviewAndNews {
  feature_key: string
  ticker: string
  summary: string
  payload: { text?: string } & Record<string, unknown>
  model: string | null
  generated_at: string
  expires_at: string
}

export const fetchAssetOverviewAndNews = (
  ticker: string,
  forceGenerate = false,
): Promise<AssetOverviewAndNews> =>
  api
    .get<AssetOverviewAndNews>(AI_ROUTES.assetOverviewAndNews, {
      params: { ticker, force_generate: forceGenerate },
    })
    .then((r) => r.data)
