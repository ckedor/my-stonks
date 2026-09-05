import { RESEARCH_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/** O que uma edição fez com uma linha, em relação à edição anterior. */
export type RecommendationChange =
  | 'entered'
  | 'increased'
  | 'reduced'
  | 'unchanged'
  | 'exited'

/** Se o ticker que o relatório nomeia é um que o catálogo carrega.
 *
 *  São três respostas e não duas: um ticker cadastrado duas vezes não é o
 *  mesmo problema de um que falta, e a tela resolve os dois de jeitos
 *  diferentes. */
export type PositionMatch = 'matched' | 'unknown' | 'ambiguous'

export interface DraftPosition {
  ticker: string
  name: string | null
  weight: number
  rationale: string | null
  target_price: number | null
  change: RecommendationChange | null
  asset_id: number | null
  asset_name: string | null
  match: PositionMatch
}

/** A leitura de um PDF, antes de alguém concordar com ela. Nada disso está
 *  no banco: vira carteira recomendada quando a tela devolve confirmado. */
export interface RecommendedPortfolioDraft {
  source_name: string | null
  title: string | null
  reference_date: string | null
  summary: string | null
  objective: string | null
  positions: DraftPosition[]
  total_weight: number
  model: string | null
}

export interface SaveRecommendedPosition {
  ticker: string
  asset_id: number | null
  name: string | null
  weight: number
  rationale: string | null
  target_price: number | null
  change: RecommendationChange | null
}

/** Que espécie de carteira é a edição: FII, ETF Global, Ações Brasil.
 *
 *  Cadastro e não união de literais: a lista é do mantenedor, e um tipo novo
 *  se cria na tela do admin, sem passar por deploy. */
export interface RecommendedPortfolioType {
  id: number
  name: string
  slug: string
}

export interface SaveRecommendedPortfolio {
  source_name: string
  type_id: number | null
  title: string
  reference_date: string
  summary: string | null
  objective: string | null
  positions: SaveRecommendedPosition[]
}

export interface ResearchSource {
  id: number
  name: string
  slug: string
}

export interface RecommendedPosition extends SaveRecommendedPosition {
  id: number
}

export interface RecommendedPortfolio {
  id: number
  source_id: number
  source: ResearchSource | null
  type_id: number | null
  type: RecommendedPortfolioType | null
  title: string
  reference_date: string
  summary: string | null
  objective: string | null
  created_at: string | null
  positions: RecommendedPosition[]
}

export const extractRecommendedPortfolio = (file: File): Promise<RecommendedPortfolioDraft> => {
  const body = new FormData()
  body.append('file', file)
  return api
    .post<RecommendedPortfolioDraft>(RESEARCH_ROUTES.recommendedPortfolioExtraction, body)
    .then((r) => r.data)
}

export const fetchRecommendedPortfolios = (): Promise<RecommendedPortfolio[]> =>
  api.get<RecommendedPortfolio[]>(RESEARCH_ROUTES.recommendedPortfolio).then((r) => r.data)

export const saveRecommendedPortfolio = (
  data: SaveRecommendedPortfolio,
): Promise<RecommendedPortfolio> =>
  api.post<RecommendedPortfolio>(RESEARCH_ROUTES.recommendedPortfolio, data).then((r) => r.data)

export const fetchRecommendedPortfolioTypes = (): Promise<RecommendedPortfolioType[]> =>
  api
    .get<RecommendedPortfolioType[]>(RESEARCH_ROUTES.recommendedPortfolioType)
    .then((r) => r.data)

export const createRecommendedPortfolioType = (
  name: string,
): Promise<RecommendedPortfolioType> =>
  api
    .post<RecommendedPortfolioType>(RESEARCH_ROUTES.recommendedPortfolioType, { name })
    .then((r) => r.data)

export const deleteRecommendedPortfolioType = (id: number): Promise<void> =>
  api.delete(RESEARCH_ROUTES.recommendedPortfolioTypeById(id)).then(() => undefined)

/** Reclassificar uma carteira já salva. O tipo é o que a tela deixa mudar. */
export const setRecommendedPortfolioType = (
  id: number,
  typeId: number | null,
): Promise<RecommendedPortfolio> =>
  api
    .patch<RecommendedPortfolio>(RESEARCH_ROUTES.recommendedPortfolioById(id), {
      type_id: typeId,
    })
    .then((r) => r.data)

export const deleteRecommendedPortfolio = (id: number): Promise<void> =>
  api.delete(RESEARCH_ROUTES.recommendedPortfolioById(id)).then(() => undefined)

/** Um ativo no consenso: quanta gente recomenda, e com que tamanho.
 *
 *  `conviction` é o peso da linha sobre o peso médio da carteira em que ela
 *  está — `1` é posição média, `2` é o dobro. Sem isso uma carteira de dez
 *  ativos pareceria sempre mais convicta que uma de trinta. */
export interface RecommendationConsensusEntry {
  asset_id: number
  ticker: string
  name: string
  logo_url: string | null
  houses: number
  portfolios: number
  average_weight: number
  conviction: number
  entered: number
  increased: number
  reduced: number
  source_names: string[]
}

export interface RecommendationConsensus {
  entries: RecommendationConsensusEntry[]
  considered_portfolios: number
  considered_sources: number
  unlinked_positions: number
  window_months: number
  oldest_reference_date: string | null
  newest_reference_date: string | null
}

export const fetchRecommendationConsensus = (
  assetType: string,
  windowMonths: number,
): Promise<RecommendationConsensus> =>
  api
    .get<RecommendationConsensus>(RESEARCH_ROUTES.recommendationConsensus, {
      params: { asset_type: assetType, window_months: windowMonths },
    })
    .then((r) => r.data)
