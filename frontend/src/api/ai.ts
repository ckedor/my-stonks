import { AI_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/** Como um artefato deixa de valer: por tempo, ou só quando alguém pede. */
export type AiFreshness = 'time' | 'manual'

export interface AiFeature {
  id: number
  key: string
  name: string
  description: string
  output_schema_version: number
  enabled: boolean
  freshness: AiFreshness
  /** Nulo quando a validade é manual. */
  ttl_hours: number | null
  created_at: string
  updated_at: string
}

export interface AiFeatureUpdate {
  name: string
  description?: string
  enabled?: boolean
  freshness: AiFreshness
  ttl_hours?: number | null
}

export interface AiPromptVersion {
  id: number
  feature_id: number
  version: number
  system: string
  template: string
  model: string
  temperature: number
  max_output_tokens: number | null
  web_search: boolean
  is_active: boolean
  notes: string
  created_at: string
}

export interface AiPromptVersionCreate {
  system?: string
  template: string
  model: string
  temperature?: number
  max_output_tokens?: number | null
  web_search?: boolean
  notes?: string
  activate?: boolean
}

/**
 * Uma resposta e o que ela custou.
 *
 * `from_cache` separa uma leitura de uma geração: mesmo payload, custos muito
 * diferentes. `generated_at` não é decoração — numa feature de validade manual
 * é a única coisa que diz se vale pedir uma nova.
 */
export interface AiArtifact<TPayload = Record<string, unknown>> {
  feature_key: string
  payload: TPayload
  schema_version: number
  model: string
  generated_at: string
  expires_at: string | null
  prompt_version: number
  from_cache: boolean
  provider: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
}

export interface AiRun {
  feature_id: number | null
  prompt_version_id: number | null
  label: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
  status: 'success' | 'failure'
  error: string | null
  trace_id: string | null
  created_at: string
}

export interface AiUsageRow {
  day: string
  label: string
  model: string
  runs: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

/**
 * O que o admin precisa para rodar uma feature de que nunca ouviu falar.
 *
 * O schema do input monta o formulário e as chaves de contexto documentam o
 * que o prompt pode citar. Os dois são declarados no handler do backend, então
 * uma feature nova ganha sua tela sem uma linha de frontend.
 */
export interface AiFeatureForm {
  feature_key: string
  input_schema: {
    properties?: Record<string, { type?: string; title?: string; description?: string }>
    required?: string[]
  }
  context_keys: string[]
}

// --- Descrição do ativo ------------------------------------------------------

export interface AiSource {
  title: string
  url: string
}

/** O rascunho do texto de cadastro de um ativo.
 *
 *  Rascunho e não descrição: a resposta vai para o formulário do admin, alguém
 *  edita, e o que persiste é o que foi salvo em `asset.summary` e
 *  `asset.description`. Descritivo por construção — não há campo de
 *  recomendação no schema do backend. */
export interface AssetDescriptionDraft {
  summary: string
  description: string
  sources: AiSource[]
}

/** Lê o que já existe e só gera quando não há nada: clicar duas vezes no botão
 *  de preencher não paga duas vezes. Querer outro rascunho é `runAiFeature`. */
export const fetchAssetDescriptionDraft = (
  assetId: number,
): Promise<AiArtifact<AssetDescriptionDraft>> =>
  api
    .get<AiArtifact<AssetDescriptionDraft>>(AI_ROUTES.assetDescriptionDraft, {
      params: { asset_id: assetId },
    })
    .then((response) => response.data)

/** Gera e substitui o que estava guardado. É o refresh, do card e do admin. */
export const runAiFeature = <TPayload = Record<string, unknown>>(
  key: string,
  input: Record<string, unknown>,
): Promise<AiArtifact<TPayload>> =>
  api.post<AiArtifact<TPayload>>(AI_ROUTES.featureRun(key), input).then((response) => response.data)

export const fetchAiFeatures = (): Promise<AiFeature[]> =>
  api.get<AiFeature[]>(AI_ROUTES.feature).then((response) => response.data)

export const updateAiFeature = (key: string, data: AiFeatureUpdate): Promise<AiFeature> =>
  api.patch<AiFeature>(AI_ROUTES.featureByKey(key), data).then((response) => response.data)

export const fetchAiFeatureForm = (key: string): Promise<AiFeatureForm> =>
  api.get<AiFeatureForm>(AI_ROUTES.featureForm(key)).then((response) => response.data)

export const fetchAiPromptVersions = (key: string): Promise<AiPromptVersion[]> =>
  api.get<AiPromptVersion[]>(AI_ROUTES.featurePromptVersion(key)).then((response) => response.data)

export const createAiPromptVersion = (
  key: string,
  data: AiPromptVersionCreate,
): Promise<AiPromptVersion> =>
  api
    .post<AiPromptVersion>(AI_ROUTES.featurePromptVersion(key), data)
    .then((response) => response.data)

export const activateAiPromptVersion = (versionId: number): Promise<AiPromptVersion> =>
  api
    .post<AiPromptVersion>(AI_ROUTES.promptVersionActivate(versionId))
    .then((response) => response.data)

export const scheduleAiFeature = (key: string): Promise<{ task_id: string; task_name: string }> =>
  api
    .post<{ task_id: string; task_name: string }>(AI_ROUTES.featureSchedule(key))
    .then((response) => response.data)

export const fetchAiUsage = (days = 30): Promise<AiUsageRow[]> =>
  api.get<AiUsageRow[]>(AI_ROUTES.usage, { params: { days } }).then((response) => response.data)

export const fetchAiRuns = (limit = 100): Promise<AiRun[]> =>
  api.get<AiRun[]>(AI_ROUTES.run, { params: { limit } }).then((response) => response.data)
