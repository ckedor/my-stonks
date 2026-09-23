import type { DraftNote, NoteCurrency, NoteSide } from '@/api/brokerageNote'
import {
  AppAutocomplete,
  AppNumberField,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { formatMoney } from '@/lib/utils/format'
import type { Asset } from '@/types'
import { useMemo } from 'react'
import { isRowInvalid, type NoteRow } from './draft'

interface LinesTableProps {
  note: DraftNote
  rows: NoteRow[]
  currency: NoteCurrency
  assets: Asset[]
  onRowChange: (lineIndex: number, patch: Partial<NoteRow>) => void
}

const SIDE_OPTIONS = [
  { value: 'C', label: 'Compra' },
  { value: 'V', label: 'Venda' },
]

/* As linhas da nota, uma por execução, como vão para o banco.
 *
 * A especificação fica como a nota imprimiu, ao lado, para conferir: o ativo
 * foi escolhido a partir dela, e pode ter sido escolhido errado. */
export default function LinesTable({ note, rows, currency, assets, onRowChange }: LinesTableProps) {
  const printed = useMemo(() => new Map(note.lines.map((line) => [line.index, line])), [note])
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])

  const columns: AppSimpleTableColumn<NoteRow>[] = [
    {
      label: 'Na nota',
      render: (row) => {
        const line = printed.get(row.line_index)
        return (
          <AppStack gap="xs">
            <AppText variant="bodySmall">{line?.security ?? '—'}</AppText>
            <AppText variant="caption" tone="secondary">
              {[line?.ticker, line?.market].filter(Boolean).join(' · ') || 'sem código'}
            </AppText>
          </AppStack>
        )
      },
    },
    {
      label: 'Lado',
      render: (row) => (
        <AppSelect
          options={SIDE_OPTIONS}
          value={row.side}
          onChange={(value) => onRowChange(row.line_index, { side: value as NoteSide })}
          size="auto"
          density="compact"
        />
      ),
    },
    {
      label: 'Ativo',
      width: 'wide',
      render: (row) => (
        <AppAutocomplete
          options={assets}
          value={row.asset_id === null ? null : (assetById.get(row.asset_id) ?? null)}
          onChange={(asset) => onRowChange(row.line_index, { asset_id: asset?.id ?? null })}
          getOptionLabel={(asset) => `${asset.ticker ?? '—'} · ${asset.name}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          label="Ativo"
          size="sm"
          placeholder="escolher"
        />
      ),
    },
    {
      label: 'Quantidade',
      align: 'right',
      render: (row) => (
        <AppNumberField
          label="Quantidade"
          hideLabel
          value={row.quantity}
          onChange={(quantity) => onRowChange(row.line_index, { quantity })}
          step={0.00001}
          size="md"
          align="right"
          error={isRowInvalid(row)}
        />
      ),
    },
    {
      label: 'Preço',
      align: 'right',
      render: (row) => (
        <AppNumberField
          label="Preço"
          hideLabel
          value={row.price}
          onChange={(price) => onRowChange(row.line_index, { price })}
          step={0.0001}
          size="md"
          align="right"
        />
      ),
    },
    {
      label: 'Valor',
      align: 'right',
      hint: 'Quantidade × preço. Confira contra o valor que a nota imprime.',
      render: (row) => formatMoney(row.quantity * row.price, currency),
    },
    {
      label: 'Custos',
      align: 'right',
      render: (row) => (
        <AppNumberField
          allowEmpty
          label="Custos"
          hideLabel
          value={row.fees}
          onChange={(fees) => onRowChange(row.line_index, { fees })}
          step={0.01}
          size="sm"
          align="right"
        />
      ),
    },
    {
      label: 'IRRF',
      align: 'right',
      render: (row) => (
        <AppNumberField
          allowEmpty
          label="IRRF"
          hideLabel
          value={row.withheld_income_tax}
          onChange={(withheld_income_tax) => onRowChange(row.line_index, { withheld_income_tax })}
          step={0.01}
          size="sm"
          align="right"
        />
      ),
    },
  ]

  return (
    <AppSimpleTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.line_index}
      surface="outlined"
      emptyMessage="O modelo não encontrou nenhuma linha nesta nota."
    />
  )
}
