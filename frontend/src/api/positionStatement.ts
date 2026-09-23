import type { NoteCurrency } from '@/api/brokerageNote'
import { POSITION_STATEMENT_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* Bater posição: o extrato de uma corretora contra as transações da carteira.
 *
 * Nada é gravado. A leitura manda o PDF ao modelo e devolve o diagnóstico; a
 * comparação refaz o diagnóstico quando a pessoa corrige o extrato ou o
 * histórico, sem ler o PDF de novo. */

export type PositionMatch =
  'match' | 'different' | 'missing_in_app' | 'missing_in_statement' | 'unresolved'

export interface StatementHolding {
  index: number
  security: string
  ticker: string | null
  quantity: number
  asset_id: number | null
}

interface DraftHolding extends StatementHolding {
  asset_name: string | null
  match: 'matched' | 'unknown' | 'ambiguous'
}

export interface PositionDiff {
  key: string
  status: PositionMatch
  asset_id: number | null
  statement_quantity: number | null
  app_quantity: number | null
  /** Extrato menos app: positivo é o que falta lançar no app. */
  difference: number | null
  holdings: number[]
}

export interface PositionStatementDraft {
  broker_name: string
  broker_cnpj: string | null
  broker_id: number | null
  currency: NoteCurrency
  as_of: string
  holdings: DraftHolding[]
  positions: PositionDiff[]
  warnings: { code: string; message: string }[]
  model: string | null
}

export const extractPositionStatement = (
  portfolioId: number,
  file: File
): Promise<PositionStatementDraft> => {
  const body = new FormData()
  body.append('portfolio_id', String(portfolioId))
  body.append('file', file)
  return api
    .post<PositionStatementDraft>(POSITION_STATEMENT_ROUTES.extraction, body)
    .then((r) => r.data)
}

export const comparePositions = (
  portfolioId: number,
  brokerId: number,
  asOf: string,
  holdings: StatementHolding[]
): Promise<PositionDiff[]> =>
  api
    .post<PositionDiff[]>(POSITION_STATEMENT_ROUTES.comparison, {
      portfolio_id: portfolioId,
      broker_id: brokerId,
      as_of: asOf,
      holdings,
    })
    .then((r) => r.data)
