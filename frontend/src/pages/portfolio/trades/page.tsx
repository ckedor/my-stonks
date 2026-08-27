import { syncTrades } from '@/actions/portfolio'
import TradeForm from '@/components/TradeForm'
import {
  AppButton,
  AppCard,
  AppPageHeader,
  AppDayField,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  LoadingSpinner,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useTradesStore } from '@/stores/portfolio/trades'
import type { Trade } from '@/types'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'

type TradeType = 'Compra' | 'Venda' | 'Todos'

const TYPE_OPTIONS = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Compra', label: 'Compra' },
  { value: 'Venda', label: 'Venda' },
]

const decimal = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

export default function PortfolioTransactionsPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)

  const { format: formatCurrency } = useCurrency()

  const trades = useTradesStore(s => s.trades)
  const loading = useTradesStore(s => s.loading) && trades.length === 0

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | undefined>()
  const [selectedAssetId, setSelectedAssetId] = useState<number | undefined>()

  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [broker, setBroker] = useState('')
  const [type, setType] = useState<TradeType>('Todos')

  useEffect(() => {
    if (trades.length > 0) {
      setEndDate(dayjs().format('YYYY-MM-DD'))
    }
  }, [trades])

  const handleNew = () => {
    setSelectedTrade(undefined)
    setSelectedAssetId(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = (trade: Trade) => {
    setSelectedTrade(trade)
    setSelectedAssetId(trade.asset_id)
    setDrawerOpen(true)
  }

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const matchTicker = trade.ticker.toLowerCase().includes(search.toLowerCase())
      const matchBroker = broker ? trade.broker === broker : true
      const matchType = type === 'Todos' || trade.type === type
      const matchStartDate = startDate
        ? dayjs(trade.date).isAfter(dayjs(startDate).subtract(1, 'day'))
        : true
      const matchEndDate = endDate ? dayjs(trade.date).isBefore(dayjs(endDate).add(1, 'day')) : true

      return matchTicker && matchBroker && matchType && matchStartDate && matchEndDate
    })
  }, [trades, search, broker, type, startDate, endDate])

  const brokers = useMemo(() => {
    return Array.from(new Set(trades.map((t) => t.broker))).sort()
  }, [trades])

  /* Numa compra não há lucro realizado: o traço é a resposta certa, e um
     zero ali seria lido como "vendeu no preço". */
  const profitCell = (value: number, isBuy: boolean, render: (value: number) => string) =>
    isBuy ? (
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
    <AppStack gap="lg">
      <AppPageHeader
        title="Trades"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Trades' },
        ]}
        actions={<AppButton onClick={handleNew}>Nova Operação</AppButton>}
      />

      <AppStack direction="row" gap="md" align="end" wrap>
        <AppSearchField
          label="Buscar por ativo"
          size="bar"
          value={search}
          onChange={setSearch}
        />
        <AppDayField label="Data início" value={startDate} onChange={setStartDate} />
        <AppDayField label="Data fim" value={endDate} onChange={setEndDate} />
        <AppSelect
          label="Corretora"
          options={[
            { value: '', label: 'Todas' },
            ...brokers.map((name) => ({ value: name, label: name })),
          ]}
          value={broker}
          onChange={setBroker}
        />
        <AppSelect
          label="Tipo"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(value) => setType(value as TradeType)}
        />
      </AppStack>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <AppCard padding="none">
          {/* A venda é que recebe o fundo rebaixado, e não a compra: eram as
              compras que vinham no fundo da página, e como elas são a maioria
              das linhas o card inteiro se dissolvia no fundo — a borda existia
              sem nada dentro para ela cercar.

              Sem `maxHeight`: a tabela rolava por dentro do card, dando uma
              segunda barra de rolagem ao lado da barra da própria página. */}
          <AppSimpleTable
            rows={filteredTrades}
            columns={columns}
            getRowKey={(trade) => trade.id}
            onRowClick={handleEdit}
            getRowSurface={(trade) => (trade.type === 'Venda' ? 'sunken' : 'paper')}
            defaultSort={{ column: 'Data', direction: 'desc' }}
          />
        </AppCard>
      )}

      <TradeForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={() => { if (selectedPortfolio) syncTrades(selectedPortfolio.id, true) }}
        trade={selectedTrade}
        assetId={selectedAssetId}
      />
    </AppStack>
  )
}
