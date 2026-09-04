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

export interface SaveRecommendedPortfolio {
  source_name: string
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

export const deleteRecommendedPortfolio = (id: number): Promise<void> =>
  api.delete(RESEARCH_ROUTES.recommendedPortfolioById(id)).then(() => undefined)
