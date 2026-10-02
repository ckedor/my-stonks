import { EMPTY_LIST } from '@/queries/empty'
import { useRefreshPortfolio, useTrades } from '@/queries/portfolio'
import TradeForm from '@/components/TradeForm'
import TradesTable from '@/components/portfolio-trades/TradesTable'
import {
  AppButton,
  AppCard,
  AppDayField,
  AppPageHeader,
  AppSearchField,
  AppSelect,
  AppStack,
  AppTableSkeleton,
  AppTabs,
} from '@/components/ui'
import type { Trade } from '@/types'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import BrokerageNoteImport from './brokerage-note/BrokerageNoteImport'
import PortfolioDocuments from './documents/PortfolioDocuments'
import PositionCheck from './position-statement/PositionCheck'

type TradeType = 'Compra' | 'Venda' | 'Todos'
type TradesTab = 'trades' | 'import' | 'position' | 'documents'

const TABS: { id: TradesTab; label: string }[] = [
  { id: 'trades', label: 'Operações' },
  { id: 'import', label: 'Importar nota' },
  { id: 'position', label: 'Bater posição' },
  { id: 'documents', label: 'Documentos' },
]

const TYPE_OPTIONS = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Compra', label: 'Compra' },
  { value: 'Venda', label: 'Venda' },
]

export default function PortfolioTransactionsPage() {
  const refreshPortfolio = useRefreshPortfolio()

  const { data, isPending: loading } = useTrades()
  const trades = data ?? EMPTY_LIST

  const [tab, setTab] = useState<TradesTab>('trades')
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
    const term = search.toLowerCase()
    return trades.filter((trade) => {
      const matchTicker =
        term === '' ||
        (trade.ticker?.toLowerCase().includes(term) ?? false) ||
        (trade.name?.toLowerCase().includes(term) ?? false)
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
        breadcrumbs={[{ label: 'Carteira', href: '/portfolio/overview' }, { label: 'Trades' }]}
        actions={
          tab === 'trades' ? <AppButton onClick={handleNew}>Nova Operação</AppButton> : undefined
        }
      />

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Seções de trades" />

      {tab === 'import' && <BrokerageNoteImport />}
      {tab === 'position' && <PositionCheck />}
      {tab === 'documents' && <PortfolioDocuments />}

      {tab === 'trades' && (
        <>
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
          {loading ? (
            <AppCard padding="md">
              <AppTableSkeleton columns={9} rows={12} />
            </AppCard>
          ) : (
            <TradesTable trades={filteredTrades} onRowClick={handleEdit} />
          )}
        </>
      )}

      <TradeForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={() => void refreshPortfolio()}
        trade={selectedTrade}
        assetId={selectedAssetId}
      />
    </AppStack>
  )
}
