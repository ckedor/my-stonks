import { useQuery } from '@tanstack/react-query'
import { useSelectedPortfolio } from '@/queries/portfolio'
import { POSITION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { AppPageHeader, AppStack } from '@/components/ui'
import type { Dayjs } from 'dayjs'
import { useCallback, useState } from 'react'
import AssetListTable from './AssetList'
import AssetListSkeleton from './AssetListSkeleton'
import AssetListToolbar from './AssetListToolbar'
import {
  readAssetListView,
  storeAssetListView,
  type AssetGroupBy,
  type AssetListView,
} from './view-state'

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

  const setView = (next: AssetListView) => {
    setViewState(next)
    storeAssetListView(next)
  }

  const { data: positions } = useQuery<any[]>({
    queryKey: ['portfolio', portfolioId, 'asset-list', groupBy, currency],
    queryFn: useCallback(() => {
      const params: Record<string, string> = { currency }
      if (groupBy === 'broker') params.group_by_broker = 'true'
      return api.get(POSITION_ROUTES.byPortfolio(portfolioId!), { params }).then(r => r.data)
    }, [portfolioId, groupBy, currency]),
    enabled: !!portfolioId,
  })

  const loading = !positions && !!portfolioId

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Ativos"
        breadcrumbs={[
          { label: 'Carteira', href: '/portfolio/overview' },
          { label: 'Ativos' },
        ]}
        actions={
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
        }
      />

      {loading ? (
        <AssetListSkeleton />
      ) : (
        <AssetListTable
          positions={positions ?? []}
          groupBy={groupBy}
          search={search}
          view={view}
        />
      )}
    </AppStack>
  )
}
