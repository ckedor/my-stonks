import { useQuery } from '@tanstack/react-query'
import { fetchFIIMarket, type FIIMarketFund } from '@/api/market'
import {
  AppCard,
  AppChartSkeleton,
  AppPageHeader,
  AppPageHeaderSkeleton,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
  AppTabs,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { ASSET_TYPES } from '@/constants/assetTypes'
import FavoriteAssets from '@/pages/market/ativos/FavoriteAssets'
import MarketBenchmarkCard from '@/pages/market/components/MarketBenchmarkCard'
import RecommendedFIIs from './RecommendedFIIs'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const titleCase = (value: string | null) => {
  if (!value) return 'Não classificado'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const money = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const multiple = (value: number | null) =>
  value == null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const percentage = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function MarketFIIPage() {
  const navigate = useNavigate()
  const fetcher = useCallback(() => fetchFIIMarket(), [])
  const { data, isPending: loading } = useQuery({
    queryKey: ['market:fii:catalogue'],
    queryFn: fetcher,
    enabled: true,
  })
  const [tab, setTab] = useState<'funds' | 'recommended'>('funds')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [segment, setSegment] = useState('all')

  const funds = useMemo(() => data?.funds ?? [], [data?.funds])
  const types = useMemo(
    () => [...new Set(funds.map((fund) => fund.type).filter(Boolean) as string[])].sort(),
    [funds],
  )
  const segments = useMemo(
    () => [...new Set(funds.map((fund) => fund.segment).filter(Boolean) as string[])].sort(),
    [funds],
  )
  const visibleFunds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return funds
      .filter((fund) => type === 'all' || fund.type === type)
      .filter((fund) => segment === 'all' || fund.segment === segment)
      .filter(
        (fund) =>
          !query ||
          fund.ticker.toLocaleLowerCase('pt-BR').includes(query) ||
          fund.name.toLocaleLowerCase('pt-BR').includes(query),
      )
      .sort((a, b) => (b.investors ?? -1) - (a.investors ?? -1))
  }, [funds, search, type, segment])

  const columns = useMemo<AppSimpleTableColumn<FIIMarketFund>[]>(() => [
    {
      label: 'Fundo',
      sortValue: (fund) => fund.ticker,
      render: (fund) => (
        <AppStack gap="none">
          <AppText variant="bodySmall">{fund.ticker}</AppText>
          <AppText variant="caption" tone="secondary">{fund.name}</AppText>
        </AppStack>
      ),
    },
    {
      label: 'Tipo',
      sortValue: (fund) => fund.type,
      render: (fund) => titleCase(fund.type),
    },
    { label: 'Segmento', sortValue: (fund) => fund.segment, render: (fund) => fund.segment ?? '—' },
    { label: 'Preço', align: 'right', sortValue: (fund) => fund.price, render: (fund) => money(fund.price) },
    { label: 'P/VP', align: 'right', sortValue: (fund) => fund.price_to_nav, render: (fund) => multiple(fund.price_to_nav) },
    { label: 'DY 12m', align: 'right', sortValue: (fund) => fund.dividend_yield_12m, render: (fund) => percentage(fund.dividend_yield_12m) },
    { label: 'Investidores', align: 'right', sortValue: (fund) => fund.investors, render: (fund) => fund.investors?.toLocaleString('pt-BR') ?? '—' },
  ], [])

  if (loading && !data) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={120} description />
        <AppSkeleton height={140} />
        <AppChartSkeleton height={420} toolbar surface="card" />
        <AppStack gap="md">
          <AppSkeleton shape="text" width={220} height={24} />
          <AppCard padding="md">
            <AppStack gap="md">
              <AppSkeleton height={48} />
              <AppTableSkeleton columns={7} rows={10} />
            </AppStack>
          </AppCard>
        </AppStack>
      </AppStack>
    )
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="FIIs"
        breadcrumbs={[
          { label: 'Mercado', href: '/market/overview' },
          { label: 'FIIs' },
        ]}
        description="Visão do universo de FIIs, com indicadores publicados e comparação dos benchmarks da classe."
      />

      <FavoriteAssets limit={8} assetTypeId={ASSET_TYPES.FII} />

      <MarketBenchmarkCard
        title="IFIX contra CDI"
        benchmarks={['IFIX', 'CDI']}
        persistKey="market-fii-benchmarks"
      />

      <AppStack gap="md">
        <AppTabs
          items={[
            { id: 'funds', label: 'Todos os FIIs' },
            { id: 'recommended', label: 'Mais recomendados' },
          ]}
          value={tab}
          onChange={setTab}
          label="Visão dos FIIs"
        />

        {tab === 'recommended' && <RecommendedFIIs />}

        {tab === 'funds' && (
        <AppStack gap="md">
        <SectionTitle>Todos os FIIs · {visibleFunds.length}</SectionTitle>
        <AppCard padding="none">
          <AppStack gap="md">
            <AppCard>
              <AppStack direction="row" gap="sm" wrap>
                <AppSearchField
                  label="Buscar fundo"
                  placeholder="Ticker ou nome"
                  value={search}
                  onChange={setSearch}
                  size="bar"
                />
                <AppSelect
                  label="Tipo"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: 'all', label: 'Todos' },
                    ...types.map((item) => ({ value: item, label: titleCase(item) })),
                  ]}
                />
                <AppSelect
                  label="Segmento"
                  value={segment}
                  onChange={setSegment}
                  size="md"
                  options={[
                    { value: 'all', label: 'Todos' },
                    ...segments.map((item) => ({ value: item, label: item })),
                  ]}
                />
              </AppStack>
            </AppCard>
            <AppSimpleTable
              rows={visibleFunds}
              columns={columns}
              getRowKey={(fund) => fund.ticker}
              onRowClick={(fund) => {
                if (fund.asset_id != null) navigate(`/market/asset/${fund.asset_id}`)
              }}
              isRowClickable={(fund) => fund.asset_id != null}
              pageSize={10}
              fixedHeight={620}
              emptyMessage="Nenhum FII encontrado."
              defaultSort={{ column: 'Investidores', direction: 'desc' }}
            />
          </AppStack>
        </AppCard>
        </AppStack>
        )}
      </AppStack>
    </AppStack>
  )
}
