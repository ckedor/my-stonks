import { BROKERAGE_NOTE_ROUTES, BROKER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* Nota de corretagem: leitura, cruzamento, import e histórico.
 *
 * A leitura manda o PDF ao modelo e devolve, por nota, a proposta; o
 * cruzamento refaz a proposta quando a pessoa escolhe um ativo ou a corretora,
 * sem ler o PDF de novo; o import grava uma nota por vez, com as decisões, e é
 * recusado (409) se a carteira mudou desde a última proposta. */

export type NoteSide = 'C' | 'V'
export type NoteCurrency = 'BRL' | 'USD'
type AssetMatch = 'matched' | 'unknown' | 'ambiguous'
export type GroupStatus = 'new' | 'unchanged' | 'update' | 'replace' | 'conflict' | 'unresolved'
export type GroupAction = 'create' | 'update' | 'replace' | 'skip'

interface NoteWarning {
  code: string
  message: string
}

export interface DraftLine {
  index: number
  side: NoteSide
  market: string | null
  security: string
  ticker: string | null
  quantity: number
  price: number
  value: number
  fees: number
  withheld_income_tax: number | null
  asset_id: number | null
  asset_name: string | null
  match: AssetMatch
}

/** Totais, custos e líquido como a nota os imprime. */
export interface NoteAmounts {
  purchases_total: number | null
  sales_total: number | null
  operations_total: number | null
  settlement_fee: number | null
  registration_fee: number | null
  emoluments: number | null
  other_exchange_fees: number | null
  brokerage: number | null
  iss: number | null
  other_costs: number | null
  withheld_income_tax: number | null
  net_amount: number | null
}

export interface DraftNote {
  index: number
  broker_name: string
  broker_cnpj: string | null
  broker_id: number | null
  currency: NoteCurrency
  note_number: string | null
  trade_date: string
  settlement_date: string | null
  amounts: NoteAmounts
  fees: number
  warnings: NoteWarning[]
  lines: DraftLine[]
  groups: ReconciliationGroup[]
  /** A mesma nota (corretora e número) já foi importada nesta carteira. */
  imported_note_id: number | null
  imported_at: string | null
}

export interface LineRef {
  note_index: number
  line_index: number
}

export interface ReconciliationGroup {
  key: string
  status: GroupStatus
  default_action: GroupAction
  actions: GroupAction[]
  broker_id: number | null
  asset_id: number | null
  trade_date: string
  side: NoteSide
  lines: LineRef[]
  existing_ids: number[]
  message: string | null
  warnings: string[]
}

export interface BrokerageNoteDraft {
  notes: DraftNote[]
  model: string | null
  /** O PDF enviado, guardado. Nulo quando o storage não está configurado. */
  document_id: number | null
}

/** Uma linha como a pessoa a conferiu: o que vai para o cruzamento e o import. */
export interface NoteLineInput {
  note_index: number
  line_index: number
  broker_id: number | null
  asset_id: number | null
  trade_date: string
  settlement_date: string | null
  side: NoteSide
  quantity: number
  price: number
  fees: number | null
  withheld_income_tax: number | null
  currency: NoteCurrency
}

export interface GroupDecision {
  key: string
  action: GroupAction
  existing_ids: number[]
}

/** A nota como será gravada ao confirmar. */
export interface NoteHeader {
  broker_id: number | null
  currency: NoteCurrency
  note_number: string | null
  trade_date: string
  settlement_date: string | null
  amounts: NoteAmounts
  /** O documento de onde a nota foi lida. */
  document_id: number | null
}

export interface ImportResult {
  note_id: number
  created: number
  updated: number
  deleted: number
  asset_ids: number[]
}

export interface Broker {
  id: number
  name: string
  cnpj: string | null
}

export const extractBrokerageNote = (
  portfolioId: number,
  file: File
): Promise<BrokerageNoteDraft> => {
  const body = new FormData()
  body.append('portfolio_id', String(portfolioId))
  body.append('file', file)
  return api.post<BrokerageNoteDraft>(BROKERAGE_NOTE_ROUTES.extraction, body).then((r) => r.data)
}

export const reconcileBrokerageNote = (
  portfolioId: number,
  lines: NoteLineInput[]
): Promise<ReconciliationGroup[]> =>
  api
    .post<ReconciliationGroup[]>(BROKERAGE_NOTE_ROUTES.reconciliation, {
      portfolio_id: portfolioId,
      lines,
    })
    .then((r) => r.data)

export const importBrokerageNote = (
  portfolioId: number,
  note: NoteHeader,
  lines: NoteLineInput[],
  decisions: GroupDecision[]
): Promise<ImportResult> =>
  api
    .post<ImportResult>(BROKERAGE_NOTE_ROUTES.notes, {
      portfolio_id: portfolioId,
      note,
      lines,
      decisions,
    })
    .then((r) => r.data)

/** Uma nota importada, para o histórico. */
export interface ImportedBrokerageNote {
  id: number
  broker_id: number
  broker_name: string
  currency: NoteCurrency
  note_number: string | null
  trade_date: string
  settlement_date: string | null
  operations_total: number | null
  fees: number
  withheld_income_tax: number | null
  net_amount: number | null
  document_id: number | null
  imported_at: string
  transaction_count: number
}

export const fetchBrokerageNotes = (portfolioId: number): Promise<ImportedBrokerageNote[]> =>
  api
    .get<ImportedBrokerageNote[]>(BROKERAGE_NOTE_ROUTES.notes, {
      params: { portfolio_id: portfolioId },
    })
    .then((r) => r.data)

export const fetchBrokers = (): Promise<Broker[]> =>
  api.get<Broker[]>(BROKER_ROUTES.list).then((r) => r.data)
