import type {
  DraftNote,
  GroupAction,
  GroupDecision,
  GroupStatus,
  LineRef,
  NoteHeader,
  NoteLineInput,
  NoteSide,
  ReconciliationGroup,
} from '@/api/brokerageNote'

/* A nota como a tela a edita, e o que o cruzamento e o import recebem.
 *
 * Tudo o que vai para o banco é editável: o cabeçalho da nota (corretora,
 * número, datas, totais e custos) e cada linha (lado, ativo, quantidade, preço,
 * custos, IRRF). A data, a liquidação, a corretora e a moeda de uma linha são
 * as da nota — mudar a nota muda todas as linhas. Fica fora dos componentes
 * para ser testado sem render. */

export const STATUS_LABEL: Record<GroupStatus, string> = {
  new: 'Nova',
  unchanged: 'Já lançada',
  update: 'Completar',
  replace: 'Substituir',
  conflict: 'Conflito',
  unresolved: 'Pendente',
}

export const STATUS_TONE: Record<
  GroupStatus,
  'neutral' | 'primary' | 'success' | 'info' | 'caution' | 'danger'
> = {
  new: 'primary',
  unchanged: 'neutral',
  update: 'info',
  replace: 'info',
  conflict: 'danger',
  unresolved: 'caution',
}

export const ACTION_LABEL: Record<GroupAction, string> = {
  create: 'Criar',
  update: 'Completar campos',
  replace: 'Substituir',
  skip: 'Ignorar',
}

export const lineKey = (ref: LineRef) => `${ref.note_index}:${ref.line_index}`

/** O que se edita numa linha. O resto vem do cabeçalho. */
export interface NoteRow {
  line_index: number
  side: NoteSide
  asset_id: number | null
  quantity: number
  price: number
  fees: number | null
  withheld_income_tax: number | null
}

export function initialHeader(note: DraftNote): NoteHeader {
  return {
    broker_id: note.broker_id,
    currency: note.currency,
    note_number: note.note_number,
    trade_date: note.trade_date,
    settlement_date: note.settlement_date,
    amounts: note.amounts,
  }
}

export function initialRows(note: DraftNote): NoteRow[] {
  return note.lines.map((line) => ({
    line_index: line.index,
    side: line.side,
    asset_id: line.asset_id,
    quantity: line.quantity,
    price: line.price,
    fees: line.fees,
    withheld_income_tax: line.withheld_income_tax,
  }))
}

export function toLineInputs(
  noteIndex: number,
  header: NoteHeader,
  rows: NoteRow[]
): NoteLineInput[] {
  return rows.map((row) => ({
    ...row,
    note_index: noteIndex,
    broker_id: header.broker_id,
    trade_date: header.trade_date,
    settlement_date: header.settlement_date,
    currency: header.currency,
  }))
}

export function updateRow(rows: NoteRow[], lineIndex: number, patch: Partial<NoteRow>): NoteRow[] {
  return rows.map((row) => (row.line_index === lineIndex ? { ...row, ...patch } : row))
}

/** Uma linha que o backend recusaria: sem quantidade ou com preço negativo. */
export const isRowInvalid = (row: NoteRow) => !(row.quantity > 0) || row.price < 0

export function defaultActions(groups: ReconciliationGroup[]): Record<string, GroupAction> {
  return Object.fromEntries(groups.map((group) => [group.key, group.default_action]))
}

export function decisionsFor(
  groups: ReconciliationGroup[],
  actions: Record<string, GroupAction>
): GroupDecision[] {
  return groups.map((group) => ({
    key: group.key,
    action: actions[group.key] ?? group.default_action,
    existing_ids: group.existing_ids,
  }))
}

/** Quantos grupos cada ação vai tocar, para o botão dizer o que confirma. */
export function countByAction(
  groups: ReconciliationGroup[],
  actions: Record<string, GroupAction>
): Record<GroupAction, number> {
  const counts: Record<GroupAction, number> = { create: 0, update: 0, replace: 0, skip: 0 }
  for (const group of groups) counts[actions[group.key] ?? group.default_action] += 1
  return counts
}
