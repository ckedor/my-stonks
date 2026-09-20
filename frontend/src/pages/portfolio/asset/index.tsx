import { useQuery } from '@tanstack/react-query'
import { EMPTY_LIST } from '@/queries/empty'
import { useClosedPositions, useSelectedPortfolio } from '@/queries/portfolio'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { AppPageHeader, AppSearchField, AppStack, AppTabs, AppTableSkeleton } from '@/components/ui'
import type { Dayjs } from 'dayjs'
import type { PortfolioPositionEntry } from '@/types'
import { useCallback, useState } from 'react'
import AssetListTable from './AssetList'
import AssetListSkeleton from './AssetListSkeleton'
import AssetListToolbar from './AssetListToolbar'
import ClosedPositionList from './ClosedPositionList'
import {
  readAssetListView,
  storeAssetListView,
  type AssetGroupBy,
  type AssetListView,
} from './view-state'

/* Duas listas, e não uma com filtro: o que está na carteira tem valor, peso e
   preço de hoje, e o que saiu tem lucro realizado e data de saída. São
   colunas diferentes porque são perguntas diferentes, e misturá-las obrigaria
   metade das linhas a mostrar traço. */
const TABS = [
  { id: 'held' as const, label: 'Em carteira' },
  { id: 'closed' as const, label: 'Encerrados' },
]

type AssetTab = (typeof TABS)[number]['id']

export default function PortfolioAssetsPage() {
  const selectedPortfolio = useSelectedPortfolio()
  const portfolioId = selectedPortfolio?.id
  const { currency } = useCurrency()

  /* Os filtros são da página, não da listagem: eles moram no cabeçalho, ao
     lado do título, no mesmo lugar em que as outras telas põem os seus. */
  const [groupBy, setGroupBy] = useState<AssetGroupBy>('category')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState<Dayjs | null>(null)
  const [view, setViewState] = useState<AssetListView>(readAssetListView)
  const [tab, setTab] = useState<AssetTab>('held')

  const setView = (next: AssetListView) => {
    setViewState(next)
    storeAssetListView(next)
  }

  const { data: positions } = useQuery<PortfolioPositionEntry[]>({
    queryKey: ['portfolio', portfolioId, 'asset-list', groupBy, currency],
    queryFn: useCallback(() => {
      const params: Record<string, string> = { currency }
      if (groupBy === 'broker') params.group_by_broker = 'true'
      return api.get(POSITION_ROUTES.byPortfolio(portfolioId!), { params }).then(r => r.data)
    }, [portfolioId, groupBy, currency]),
    enabled: !!portfolioId,
  })

  const { data: closedPositions } = useClosedPositions(tab === 'closed')

  const loading = !positions && !!portfolioId
  const closedLoading = tab === 'closed' && !closedPositions && !!portfolioId

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Ativos"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Ativos' },
        ]}
        actions={
          /* Agrupamento, data e modo de exibição são da listagem em carteira.
             Na lista de encerrados não há grupo que some nem cards — sobra a
             busca, que é a mesma pergunta nas duas. */
          tab === 'held' ? (
            <AssetListToolbar
              search={search}
              onSearchChange={setSearch}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              date={date}
              onDateChange={setDate}
              view={view}
              onViewChange={setView}
            />
          ) : (
            <AppSearchField
              label="Buscar ativo"
              placeholder="Buscar ativo…"
              hideLabel
              icon
              size="bar"
              value={search}
              onChange={setSearch}
            />
          )
        }
      />

      <AppTabs items={TABS} value={tab} onChange={setTab} label="Ativos da carteira" />

      {tab === 'held' &&
        (loading ? (
          <AssetListSkeleton />
        ) : (
          <AssetListTable
            positions={positions ?? []}
            groupBy={groupBy}
            search={search}
            view={view}
          />
        ))}

      {tab === 'closed' &&
        (closedLoading ? (
          <AppTableSkeleton columns={9} rows={8} />
        ) : (
          <ClosedPositionList positions={closedPositions ?? EMPTY_LIST} search={search} />
        ))}
    </AppStack>
  )
}
