import type {
  GroupAction,
  NoteCurrency,
  NoteLineInput,
  ReconciliationGroup,
} from '@/api/brokerageNote'
import {
  AppChip,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/utils/format'
import type { Asset, Trade } from '@/types'
import { useMemo } from 'react'
import { ACTION_LABEL, STATUS_LABEL, STATUS_TONE, lineKey } from './draft'

interface ReconciliationTableProps {
  groups: ReconciliationGroup[]
  lines: NoteLineInput[]
  currency: NoteCurrency
  assets: Asset[]
  trades: Trade[]
  actions: Record<string, GroupAction>
  onActionChange: (key: string, action: GroupAction) => void
}

const quantity = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

interface Priced {
  quantity: number
  price: number
}

const valueOf = (pairs: Priced[]) =>
  pairs.reduce((sum, pair) => sum + Math.abs(pair.quantity) * pair.price, 0)

/* Um grupo por ativo, corretora, pregão e lado: é nessa unidade que a nota se
 * cruza com a carteira, porque é nela que o lançamento manual costuma estar.
 * Aqui só se decide o que fazer com cada grupo; o que a nota diz se edita nas
 * linhas acima. */
export default function ReconciliationTable({
  groups,
  lines,
  currency,
  assets,
  trades,
  actions,
  onActionChange,
}: ReconciliationTableProps) {
  const inputByKey = useMemo(() => new Map(lines.map((line) => [lineKey(line), line])), [lines])
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const tradeById = useMemo(() => new Map(trades.map((trade) => [trade.id, trade])), [trades])

  const noteLinesOf = (group: ReconciliationGroup) =>
    group.lines
      .map((ref) => inputByKey.get(lineKey(ref)))
      .filter((line): line is NoteLineInput => line !== undefined)

  /** "30 × US$ 111,17 (3)": quantidade total, preço médio e quantas execuções. */
  const summary = (pairs: Priced[]) => {
    if (pairs.length === 0) return '—'
    const total = pairs.reduce((sum, pair) => sum + Math.abs(pair.quantity), 0)
    const executions = pairs.length > 1 ? ` (${pairs.length})` : ''
    return `${quantity(total)} × ${formatMoney(valueOf(pairs) / total, currency)}${executions}`
  }

  const columns: AppSimpleTableColumn<ReconciliationGroup>[] = [
    {
      label: 'Situação',
      render: (group) => (
        <AppChip label={STATUS_LABEL[group.status]} tone={STATUS_TONE[group.status]} />
      ),
    },
    { label: 'Pregão', render: (group) => formatDate(group.trade_date) },
    { label: 'Lado', render: (group) => (group.side === 'C' ? 'Compra' : 'Venda') },
    {
      label: 'Ativo',
      render: (group) => {
        const asset = group.asset_id === null ? null : assetById.get(group.asset_id)
        return asset ? (asset.ticker ?? asset.name) : '—'
      },
    },
    { label: 'Na nota', align: 'right', render: (group) => summary(noteLinesOf(group)) },
    {
      label: 'Valor',
      align: 'right',
      render: (group) => formatMoney(valueOf(noteLinesOf(group)), currency),
    },
    {
      label: 'Custos',
      align: 'right',
      render: (group) =>
        formatMoney(
          noteLinesOf(group).reduce((sum, line) => sum + (line.fees ?? 0), 0),
          currency
        ),
    },
    {
      label: 'Na carteira',
      align: 'right',
      hint: 'O que já está lançado para o mesmo ativo, dia e lado.',
      render: (group) =>
        summary(
          group.existing_ids
            .map((id) => tradeById.get(id))
            .filter((trade): trade is Trade => trade !== undefined)
            .map((trade) => ({ quantity: trade.quantity, price: trade.original_price }))
        ),
    },
    {
      label: 'Observação',
      render: (group) => (
        <AppStack gap="xs">
          {group.message && <AppText variant="bodySmall">{group.message}</AppText>}
          {group.warnings.map((warning) => (
            <AppText key={warning} variant="bodySmall" tone="caution">
              {warning}
            </AppText>
          ))}
        </AppStack>
      ),
    },
    {
      label: 'Ação',
      render: (group) =>
        group.actions.length === 1 ? (
          <AppText variant="bodySmall" tone="secondary">
            {ACTION_LABEL[group.actions[0]]}
          </AppText>
        ) : (
          <AppSelect
            options={group.actions.map((action) => ({
              value: action,
              label: ACTION_LABEL[action],
            }))}
            value={actions[group.key] ?? group.default_action}
            onChange={(value) => onActionChange(group.key, value as GroupAction)}
            size="auto"
            density="compact"
          />
        ),
    },
  ]

  return (
    <AppSimpleTable
      rows={groups}
      columns={columns}
      getRowKey={(group) => group.key}
      surface="outlined"
      emptyMessage="Nenhuma operação para cruzar."
    />
  )
}
