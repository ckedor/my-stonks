import {
  AppButton,
  AppSimpleTable,
  AppStack,
  AppText,
  LoadingSpinner,
  SectionTitle,
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

    setTrades(data.sort((a: Trade, b: Trade) => new Date(b.date).getTime() - new Date(a.date).getTime()))
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

  const columns: AppSimpleTableColumn<Trade>[] = [
    { label: 'Data', render: (trade) => dayjs(trade.date).format('DD/MM/YYYY') },
    { label: 'Ativo', render: (trade) => trade.ticker },
    { label: 'Corretora', render: (trade) => trade.broker },
    {
      label: 'Tipo',
      render: (trade) => (
        <AppText variant="body" weight="strong" tone={trade.type === 'Compra' ? 'primary' : 'success'} inline>
          {trade.type}
        </AppText>
      ),
    },
    { label: 'Qtd', align: 'right', render: (trade) => number(trade.quantity) },
    { label: 'Qtd Acum.', align: 'right', render: (trade) => number(trade.acc_quantity) },
    { label: 'Preço', align: 'right', render: (trade) => formatCurrency(trade.price) },
    { label: 'Valor Total', align: 'right', render: (trade) => formatCurrency(trade.value) },
    { label: 'Posição na Data', align: 'right', render: (trade) => formatCurrency(trade.position) },
    { label: 'Preço Médio', align: 'right', render: (trade) => formatCurrency(trade.average_price) },
    {
      label: 'Lucro Realizado',
      align: 'right',
      // Compra não realiza lucro: o traço diz isso melhor do que um zero,
      // que se leria como "realizou zero".
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
      <AppStack direction="row" justify="between" align="center" gap="md">
        <SectionTitle>Compras / Vendas</SectionTitle>
        <AppButton onClick={handleNew}>Nova Operação</AppButton>
      </AppStack>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <AppSimpleTable
          rows={trades}
          columns={columns}
          getRowKey={(trade) => trade.id}
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
