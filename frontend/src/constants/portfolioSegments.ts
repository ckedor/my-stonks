import {
  CONCENTRATION_DIMENSIONS,
  type ConcentrationDimension,
} from '@/components/portfolio-slice/concentration'

/* Os recortes da carteira por tipo de ativo.
 *
 * Quem decide a que segmento uma posição pertence é o backend, que devolve o
 * segmento junto com a posição — a regra que separa a ação brasileira da
 * estrangeira mora num lugar só, e não é aqui. O que mora aqui é o que a tela
 * precisa saber para desenhar o segmento: como ele se chama, por onde se
 * entra nele, contra o que ele se compara e por quais dimensões a
 * concentração dele é lida.
 *
 * Os identificadores são os mesmos que o backend publica em
 * `/portfolio/position/{id}/segment/{segment}/...`. */

export type PortfolioSegmentId =
  | 'fii'
  | 'equity-br'
  | 'equity-world'
  | 'fixed-income'
  | 'crypto'

export interface PortfolioSegmentDefinition {
  id: PortfolioSegmentId
  /** O rótulo da tela, que é o mesmo de `src/layouts/navigation.ts`. */
  label: string
  path: string
  /** Séries contra as quais o segmento se compara por padrão. */
  benchmarks: string[]
  dimensions: ConcentrationDimension[]
}

const D = CONCENTRATION_DIMENSIONS

export const PORTFOLIO_SEGMENTS: Record<PortfolioSegmentId, PortfolioSegmentDefinition> = {
  fii: {
    id: 'fii',
    label: 'FIIs',
    path: '/portfolio/fii',
    benchmarks: ['IFIX', 'CDI'],
    dimensions: [D.asset, D.fiiType, D.fiiSegment],
  },
  'equity-br': {
    id: 'equity-br',
    label: 'Ações/ETFs BR',
    path: '/portfolio/equity-br',
    benchmarks: ['IBOVESPA', 'CDI'],
    dimensions: [D.asset, D.assetType, D.sector, D.industry],
  },
  'equity-world': {
    id: 'equity-world',
    label: 'Ações/ETFs Mundo',
    path: '/portfolio/equity-world',
    benchmarks: ['S&P500', 'NASDAQ'],
    dimensions: [D.asset, D.assetType, D.sector, D.country],
  },
  'fixed-income': {
    id: 'fixed-income',
    label: 'Renda Fixa',
    path: '/portfolio/fixed-income',
    benchmarks: ['CDI', 'IPCA'],
    dimensions: [D.asset, D.assetType, D.fixedIncomeIndex],
  },
  crypto: {
    id: 'crypto',
    label: 'Cripto',
    path: '/portfolio/crypto',
    benchmarks: ['CDI'],
    dimensions: [D.asset, D.category],
  },
}

export const PORTFOLIO_SEGMENT_LIST: PortfolioSegmentDefinition[] =
  Object.values(PORTFOLIO_SEGMENTS)
