import type { PositionDiff, StatementHolding } from '@/api/positionStatement'
import { AppChip, AppSimpleTable, AppText, type AppSimpleTableColumn } from '@/components/ui'
import type { Asset } from '@/types'
import { useMemo } from 'react'
import { MATCH_LABEL, MATCH_TONE } from './check'

interface DiffTableProps {
  positions: PositionDiff[]
  holdings: StatementHolding[]
  assets: Asset[]
  selectedAssetId: number | null
  onSelect: (assetId: number) => void
}

const quantity = (value: number | null) =>
  value == null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

/* Um ativo por linha, divergências primeiro. Clicar num ativo abre as
 * operações dele naquela corretora, que é onde a diferença se corrige. */
export default function DiffTable({
  positions,
  holdings,
  assets,
  selectedAssetId,
  onSelect,
}: DiffTableProps) {
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const holdingByIndex = useMemo(
    () => new Map(holdings.map((holding) => [holding.index, holding])),
    [holdings]
  )

  const label = (diff: PositionDiff) => {
    const asset = diff.asset_id === null ? null : assetById.get(diff.asset_id)
    if (asset) return asset.ticker ?? asset.name
    return holdingByIndex.get(diff.holdings[0])?.security ?? '—'
  }

  const columns: AppSimpleTableColumn<PositionDiff>[] = [
    {
      label: 'Situação',
      render: (diff) => <AppChip label={MATCH_LABEL[diff.status]} tone={MATCH_TONE[diff.status]} />,
    },
    { label: 'Ativo', render: label },
    {
      label: 'No extrato',
      align: 'right',
      render: (diff) => quantity(diff.statement_quantity),
    },
    {
      label: 'No app',
      align: 'right',
      hint: 'Soma das operações nesta corretora até a data do extrato, com desdobramentos e grupamentos.',
      render: (diff) => quantity(diff.app_quantity),
    },
    {
      label: 'Diferença',
      align: 'right',
      hint: 'Extrato menos app. Positiva: falta lançar compra (ou sobra venda) no app.',
      render: (diff) =>
        diff.difference == null || diff.status === 'match' ? (
          '—'
        ) : (
          <AppText variant="bodySmall" weight="strong" tone="danger" inline>
            {diff.difference > 0 ? '+' : ''}
            {quantity(diff.difference)}
          </AppText>
        ),
    },
  ]

  return (
    <AppSimpleTable
      rows={positions}
      columns={columns}
      getRowKey={(diff) => diff.key}
      surface="outlined"
      onRowClick={(diff) => diff.asset_id !== null && onSelect(diff.asset_id)}
      isRowClickable={(diff) => diff.asset_id !== null}
      isRowSelected={(diff) => diff.asset_id !== null && diff.asset_id === selectedAssetId}
      emptyMessage="Nem o extrato nem o app têm posição nesta corretora."
    />
  )
}
