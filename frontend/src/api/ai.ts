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
  api.get<AIFeature[]>('/ai/features').then((r) => r.data)

export const updateAIFeature = (id: number, data: AIFeatureUpdate): Promise<AIFeature> =>
  api.patch<AIFeature>(`/ai/features/${id}`, data).then((r) => r.data)

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
    .get<AssetOverviewAndNews>('/ai/asset_overview_and_news', {
      params: { ticker, force_generate: forceGenerate },
    })
    .then((r) => r.data)
