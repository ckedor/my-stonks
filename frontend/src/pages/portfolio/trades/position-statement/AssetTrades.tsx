import { AppChip, AppSimpleTable, type AppSimpleTableColumn } from '@/components/ui'
import { formatMoney } from '@/lib/utils/format'
import type { Trade } from '@/types'
import dayjs from 'dayjs'
import { isWithoutNote } from './check'

interface AssetTradesProps {
  trades: Trade[]
  onEdit: (trade: Trade) => void
}

const quantity = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

/* As operações do ativo na corretora, até a data do extrato. As lançadas sem
 * nota são as candidatas: uma operação que veio de nota já foi conferida
 * contra o documento da corretora. */
export default function AssetTrades({ trades, onEdit }: AssetTradesProps) {
  const columns: AppSimpleTableColumn<Trade>[] = [
    { label: 'Data', render: (trade) => dayjs(trade.date).format('DD/MM/YYYY') },
    { label: 'Tipo', render: (trade) => trade.type },
    { label: 'Quantidade', align: 'right', render: (trade) => quantity(trade.quantity) },
    {
      label: 'Preço',
      align: 'right',
      render: (trade) => formatMoney(trade.original_price, trade.currency),
    },
    {
      label: 'Origem',
      render: (trade) =>
        isWithoutNote(trade) ? (
          <AppChip label="Sem nota" tone="caution" />
        ) : (
          <AppChip label="Nota" tone="neutral" emphasis="outline" />
        ),
    },
  ]

  return (
    <AppSimpleTable
      rows={trades}
      columns={columns}
      getRowKey={(trade) => trade.id}
      surface="outlined"
      onRowClick={onEdit}
      emptyMessage="Nenhuma operação deste ativo nesta corretora até a data."
    />
  )
}
