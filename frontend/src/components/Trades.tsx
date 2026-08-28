import {
  AppButton,
  AppSimpleTable,
  AppStack,
  AppTableSkeleton,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { TRANSACTION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Trade } from '@/types'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import TradeForm from './TradeForm'

interface TradesProps {
  assetId?: number
  assetTypes?: number[]
  currencyId?: number
}

/** Passando disto a tabela rola por dentro, e o cabeçalho fica parado. */
const TABLE_MAX_HEIGHT = 420

type Tone = 'default' | 'secondary' | 'success' | 'danger'

const sign = (value: number): Tone =>
  value > 0 ? 'success' : value < 0 ? 'danger' : 'secondary'

export default function Trades({ assetId, assetTypes, currencyId }: TradesProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | undefined>()
  const { selectedPortfolio } = usePortfolioStore()
  const { format: formatCurrency } = useCurrency()

  const fetchTrades = async () => {
    if (!selectedPortfolio) return
    setLoading(true)

    const params: Record<string, any> = {}

    if (assetTypes && assetTypes.length > 0) {
      params.asset_type_ids = assetTypes
    } else if (assetId) {
      params.asset_id = assetId
    }

    if (currencyId) {
      params.currency_id = currencyId
    }

    const { data } = await api.get(TRANSACTION_ROUTES.list, { params: { portfolio_id: selectedPortfolio.id, ...params } })

    setTrades(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTrades()
  }, [selectedPortfolio, assetId, currencyId, JSON.stringify(assetTypes)])

  const handleNew = () => {
    setSelectedTrade(undefined)
    setDrawerOpen(true)
  }

  const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

  /* Mesmo critério da tela de trades da carteira: ordena a coluna que
     responde a uma pergunta fora da ordem de data. `Qtd Acum.`, `Posição na
     Data` e `Preço Médio` são acumulados linha a linha e só se leem na ordem
     em que aconteceram. */
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
        <AppText variant="body" weight="strong" tone={trade.type === 'Compra' ? 'primary' : 'success'} inline>
          {trade.type}
        </AppText>
      ),
    },
    {
      label: 'Qtd',
      align: 'right',
      sortValue: (trade) => trade.quantity,
      render: (trade) => number(trade.quantity),
    },
    { label: 'Qtd Acum.', align: 'right', render: (trade) => number(trade.acc_quantity) },
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
      // Compra não realiza lucro: o traço diz isso melhor do que um zero,
      // que se leria como "realizou zero". Pelo mesmo motivo ela não entra na
      // ordenação e vai para o fim, junto do que não tem valor.
      sortValue: (trade) => (trade.type === 'Compra' ? null : trade.realized_profit),
      render: (trade) =>
        trade.type === 'Compra' ? (
          '-'
        ) : (
          <AppText variant="body" weight="strong" tone={sign(trade.realized_profit)} inline>
            {formatCurrency(trade.realized_profit)}
          </AppText>
        ),
    },
    {
      label: '%Lucro',
      align: 'right',
      sortValue: (trade) => (trade.type === 'Compra' ? null : trade.profit_pct),
      render: (trade) =>
        trade.type === 'Compra' ? (
          '-'
        ) : (
          <AppText variant="body" weight="strong" tone={sign(trade.profit_pct)} inline>
            {`${trade.profit_pct.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} %`}
          </AppText>
        ),
    },
  ]

  return (
    <AppStack gap="md">
      {/* Sem título: a aba que trouxe a tabela até aqui já se chama Trades, e
          o card não precisa repetir o nome da aba. */}
      <AppStack direction="row" justify="end" align="center" gap="md">
        <AppButton onClick={handleNew}>Nova Operação</AppButton>
      </AppStack>

      {loading ? (
        <AppTableSkeleton columns={8} rows={8} />
      ) : (
        <AppSimpleTable
          rows={trades}
          columns={columns}
          getRowKey={(trade) => trade.id}
          defaultSort={{ column: 'Data', direction: 'desc' }}
          maxHeight={TABLE_MAX_HEIGHT}
          onRowClick={(trade) => {
            setSelectedTrade(trade)
            setDrawerOpen(true)
          }}
          emptyMessage="Nenhuma operação registrada."
        />
      )}

      <TradeForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={fetchTrades}
        trade={selectedTrade}
        assetId={assetId}
      />
    </AppStack>
  )
}
