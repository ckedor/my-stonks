import { syncTrades } from '@/actions/portfolio'
import TradeForm from '@/components/TradeForm'
import TradesTable from '@/components/portfolio-trades/TradesTable'
import {
  AppButton,
  AppPageHeader,
  AppDayField,
  AppSearchField,
  AppSelect,
  AppStack,
  LoadingSpinner,
} from '@/components/ui'
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

export default function PortfolioTransactionsPage() {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)

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

      {/* Sem `maxHeight`: a tabela rolava por dentro do card, dando uma
          segunda barra de rolagem ao lado da barra da própria página. */}
      {loading ? <LoadingSpinner /> : <TradesTable trades={filteredTrades} onRowClick={handleEdit} />}

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
