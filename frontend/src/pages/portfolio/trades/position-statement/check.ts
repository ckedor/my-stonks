import type {
  PositionMatch,
  PositionStatementDraft,
  StatementHolding,
} from '@/api/positionStatement'
import type { Trade } from '@/types'
import dayjs from 'dayjs'

/* A conferência como a tela a manipula. Fica fora dos componentes para ser
 * testada sem render. */

export const MATCH_LABEL: Record<PositionMatch, string> = {
  match: 'Igual',
  different: 'Diverge',
  missing_in_app: 'Só no extrato',
  missing_in_statement: 'Só no app',
  unresolved: 'Sem ativo',
}

export const MATCH_TONE: Record<
  PositionMatch,
  'neutral' | 'primary' | 'success' | 'info' | 'caution' | 'danger'
> = {
  match: 'success',
  different: 'danger',
  missing_in_app: 'caution',
  missing_in_statement: 'caution',
  unresolved: 'neutral',
}

export function initialHoldings(draft: PositionStatementDraft): StatementHolding[] {
  return draft.holdings.map(({ index, security, ticker, quantity, asset_id }) => ({
    index,
    security,
    ticker,
    quantity,
    asset_id,
  }))
}

export function updateHolding(
  holdings: StatementHolding[],
  index: number,
  patch: Partial<StatementHolding>
): StatementHolding[] {
  return holdings.map((holding) => (holding.index === index ? { ...holding, ...patch } : holding))
}

/** As operações de um ativo naquela corretora até a data do extrato, da mais
 *  recente para a mais antiga. */
export function tradesOf(
  trades: Trade[],
  assetId: number,
  brokerId: number,
  asOf: string
): Trade[] {
  return trades
    .filter(
      (trade) =>
        trade.asset_id === assetId &&
        trade.broker_id === brokerId &&
        dayjs(trade.date).format('YYYY-MM-DD') <= asOf
    )
    .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
}

/** Operação lançada à mão, sem nota que a confirme: a primeira suspeita
 *  quando a quantidade não bate. */
export const isWithoutNote = (trade: Trade) => trade.brokerage_note_id == null
