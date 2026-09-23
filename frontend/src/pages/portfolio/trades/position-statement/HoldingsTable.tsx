import type { StatementHolding } from '@/api/positionStatement'
import {
  AppAutocomplete,
  AppNumberField,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import type { Asset } from '@/types'
import { useMemo } from 'react'

interface HoldingsTableProps {
  holdings: StatementHolding[]
  assets: Asset[]
  onChange: (index: number, patch: Partial<StatementHolding>) => void
}

/* O extrato como o modelo leu, para corrigir antes de confiar no diagnóstico:
 * o ativo pode ter sido escolhido errado, e a quantidade, lida errado. */
export default function HoldingsTable({ holdings, assets, onChange }: HoldingsTableProps) {
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])

  const columns: AppSimpleTableColumn<StatementHolding>[] = [
    {
      label: 'No extrato',
      render: (holding) => (
        <AppStack gap="xs">
          <AppText variant="bodySmall">{holding.security}</AppText>
          <AppText variant="caption" tone="secondary">
            {holding.ticker ?? 'sem código'}
          </AppText>
        </AppStack>
      ),
    },
    {
      label: 'Ativo',
      width: 'wide',
      render: (holding) => (
        <AppAutocomplete
          options={assets}
          value={holding.asset_id === null ? null : (assetById.get(holding.asset_id) ?? null)}
          onChange={(asset) => onChange(holding.index, { asset_id: asset?.id ?? null })}
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
      render: (holding) => (
        <AppNumberField
          label="Quantidade"
          hideLabel
          value={holding.quantity}
          onChange={(quantity) => onChange(holding.index, { quantity })}
          step={0.00001}
          size="md"
          align="right"
        />
      ),
    },
  ]

  return (
    <AppSimpleTable
      rows={holdings}
      columns={columns}
      getRowKey={(holding) => holding.index}
      surface="outlined"
      emptyMessage="O modelo não encontrou posição neste extrato."
    />
  )
}
