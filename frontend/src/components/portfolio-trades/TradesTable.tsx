import {
  AppCard,
  AppSimpleTable,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import type { Trade } from '@/types'
import dayjs from 'dayjs'

const decimal = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

/* Numa compra não há lucro realizado: o traço é a resposta certa, e um
 * zero ali seria lido como "vendeu no preço". */
function profitCell(value: number, isBuy: boolean, render: (value: number) => string) {
  return isBuy ? (
    '-'
  ) : (
    <AppText
      variant="bodySmall"
      weight="strong"
      tone={value > 0 ? 'success' : value < 0 ? 'danger' : 'secondary'}
      inline
    >
      {render(value)}
    </AppText>
  )
}

export interface TradesTableProps {
  trades: Trade[]
  /** Sem ela a tabela é só leitura — é como as abas de recorte a usam. */
  onRowClick?: (trade: Trade) => void
  maxHeight?: number
}

/** As operações da carteira, ou de um recorte dela.
 *
 *  A venda é que recebe o fundo rebaixado, e não a compra: eram as compras que
 *  vinham no fundo da página, e como elas são a maioria das linhas o card
 *  inteiro se dissolvia no fundo — a borda existia sem nada dentro para ela
 *  cercar. */
export default function TradesTable({ trades, onRowClick, maxHeight }: TradesTableProps) {
  const { format: formatCurrency } = useCurrency()

  /* Ordenável é a coluna que responde a uma pergunta fora da ordem de data:
     qual foi a maior compra, quanto se pagou por ativo, qual venda deu mais
     lucro. Ficam de fora `Qtd Acum.`, `Posição na Data` e `Preço Médio` — as
     três são acumuladas por ativo até aquela linha, e ordenar a carteira
     inteira por elas mistura séries de ativos diferentes: o topo não seria
     "a maior posição", seria a linha mais recente do ativo mais antigo. */
  const columns: AppSimpleTableColumn<Trade>[] = [
    {
      label: 'Data',
      sortValue: (trade) => dayjs(trade.date).valueOf(),
      render: (trade) => dayjs(trade.date).format('DD/MM/YYYY'),
    },
    { label: 'Ativo', sortValue: (trade) => trade.ticker, render: (trade) => trade.ticker },
    { label: 'Corretora', sortValue: (trade) => trade.broker, render: (trade) => trade.broker },
    {
      label: 'Tipo',
      sortValue: (trade) => trade.type,
      render: (trade) => (
        <AppText
          variant="bodySmall"
          weight="strong"
          tone={trade.type === 'Compra' ? 'primary' : 'success'}
          inline
        >
          {trade.type}
        </AppText>
      ),
    },
    {
      label: 'Qtd',
      align: 'right',
      sortValue: (trade) => trade.quantity,
      render: (trade) => decimal(trade.quantity),
    },
    { label: 'Qtd Acum.', align: 'right', render: (trade) => decimal(trade.acc_quantity) },
    {
      label: 'Preço',
      align: 'right',
      sortValue: (trade) => trade.price,
      render: (trade) => formatCurrency(trade.price),
    },
    {
      label: 'Valor Total',
      align: 'right',
      sortValue: (trade) => trade.value,
      render: (trade) => formatCurrency(trade.value),
    },
    { label: 'Posição na Data', align: 'right', render: (trade) => formatCurrency(trade.position) },
    { label: 'Preço Médio', align: 'right', render: (trade) => formatCurrency(trade.average_price) },
    {
      label: 'Lucro Realizado',
      align: 'right',
      /* Compra não realiza lucro e mostra traço: ordenar por zero a
         empilharia junto do prejuízo, então ela sai da conta e vai para o
         fim, que é onde a tabela põe o valor ausente. */
      sortValue: (trade) => (trade.type === 'Compra' ? null : trade.realized_profit),
      render: (trade) =>
        profitCell(trade.realized_profit, trade.type === 'Compra', formatCurrency),
    },
    {
      label: '%Lucro',
      align: 'right',
      sortValue: (trade) => (trade.type === 'Compra' ? null : trade.profit_pct),
      render: (trade) =>
        profitCell(
          trade.profit_pct,
          trade.type === 'Compra',
          (value) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} %`,
        ),
    },
  ]

  return (
    <AppCard padding="none">
      <AppSimpleTable
        rows={trades}
        columns={columns}
        getRowKey={(trade) => trade.id}
        onRowClick={onRowClick}
        getRowSurface={(trade) => (trade.type === 'Venda' ? 'sunken' : 'paper')}
        defaultSort={{ column: 'Data', direction: 'desc' }}
        maxHeight={maxHeight}
        emptyMessage="Nenhuma operação encontrada"
      />
    </AppCard>
  )
}
