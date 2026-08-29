import { useQuery } from '@tanstack/react-query'
import {
  fetchMarketCatalogue,
  type MarketCatalogueAsset,
  type MarketCatalogueKind,
} from '@/api/market'
import {
  AppCard,
  AppChartSkeleton,
  AppPageHeader,
  AppPageHeaderSkeleton,
  AppSearchField,
  AppSimpleTable,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { ASSET_TYPES } from '@/constants/assetTypes'
import FavoriteAssets from '@/pages/market/ativos/FavoriteAssets'
import MarketBenchmarkCard from '@/pages/market/components/MarketBenchmarkCard'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface MarketPageConfig {
  assetTypeId: number
  breadcrumb: string
  description: string
  itemLabel: string
  kind: MarketCatalogueKind
  pageTitle: string
  sectionTitle: string
  benchmarkTitle: string
  benchmarks: string[]
  showMarketCap?: boolean
  volumeAsMoney?: boolean
}

const CONFIG: Record<MarketCatalogueKind, MarketPageConfig> = {
  stock: {
    assetTypeId: ASSET_TYPES.STOCK,
    breadcrumb: 'Ações',
    description: 'Cotações das ações negociadas na B3 e comparação com os benchmarks da classe.',
    itemLabel: 'ação',
    kind: 'stock',
    pageTitle: 'BR · Mercado de Ações',
    sectionTitle: 'Todas as ações',
    benchmarkTitle: 'IBOVESPA contra CDI',
    benchmarks: ['IBOVESPA', 'CDI'],
    showMarketCap: true,
  },
  etf: {
    assetTypeId: ASSET_TYPES.ETF,
    breadcrumb: 'ETFs',
    description: 'Cotações dos ETFs negociados na B3 e comparação dos principais benchmarks.',
    itemLabel: 'ETF',
    kind: 'etf',
    pageTitle: 'BR · Mercado de ETFs',
    sectionTitle: 'Todos os ETFs',
    benchmarkTitle: 'IBOVESPA e S&P 500 contra CDI',
    benchmarks: ['IBOVESPA', 'S&P500', 'CDI'],
  },
  crypto: {
    assetTypeId: ASSET_TYPES.CRIPTO,
    breadcrumb: 'Cripto',
    description: 'Cotações de criptoativos em reais e desempenho do Bitcoin contra o CDI.',
    itemLabel: 'criptoativo',
    kind: 'crypto',
    pageTitle: 'Mercado de Criptoativos',
    sectionTitle: 'Todos os criptoativos',
    benchmarkTitle: 'Bitcoin contra CDI',
    benchmarks: ['CDI'],
    volumeAsMoney: true,
  },
}

export default function MarketCataloguePage({ kind }: { kind: MarketCatalogueKind }) {
  const config = CONFIG[kind]
  const navigate = useNavigate()
  const fetcher = useCallback(() => fetchMarketCatalogue(kind), [kind])
  const { data, isPending: loading } = useQuery({
    queryKey: [`market:${kind}:catalogue`],
    queryFn: fetcher,
    enabled: true,
  })
  const [search, setSearch] = useState('')

  const visibleAssets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return (data?.assets ?? []).filter(
      (asset) =>
        !query ||
        asset.ticker.toLocaleLowerCase('pt-BR').includes(query) ||
        asset.name.toLocaleLowerCase('pt-BR').includes(query),
    )
  }, [data?.assets, search])
  const catalogueAssetIds = useMemo(
    () => (data?.assets ?? [])
      .map((asset) => asset.asset_id)
      .filter((assetId): assetId is number => assetId != null),
    [data?.assets],
  )

  const columns = useMemo(
    () => catalogueColumns(config),
    [config],
  )

  const bitcoinId = kind === 'crypto'
    ? data?.assets.find((asset) => asset.ticker === 'BTC')?.asset_id ?? null
    : null

  if (loading && !data) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={200} description />
        <AppSkeleton height={140} />
        <AppChartSkeleton height={420} toolbar surface="card" />
        <AppStack gap="md">
          <AppSkeleton shape="text" width={220} height={24} />
          <AppCard padding="md">
            <AppStack gap="md">
              <AppSkeleton height={48} />
              <AppTableSkeleton columns={6} rows={10} />
            </AppStack>
          </AppCard>
        </AppStack>
      </AppStack>
    )
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title={config.pageTitle}
        breadcrumbs={[
          { label: 'Mercado', href: '/market/overview' },
          { label: config.breadcrumb },
        ]}
        description={config.description}
      />

      <FavoriteAssets
        limit={8}
        assetTypeId={config.assetTypeId}
        assetIds={catalogueAssetIds}
      />

      <MarketBenchmarkCard
        title={config.benchmarkTitle}
        benchmarks={config.benchmarks}
        persistKey={`market-${kind}-benchmarks`}
        external={kind === 'crypto' ? {
          assetId: bitcoinId,
          key: 'BTC',
          label: 'Bitcoin',
          color: '#f7931a',
        } : undefined}
      />

      <AppStack gap="md">
        <SectionTitle>{config.sectionTitle} · {visibleAssets.length}</SectionTitle>
        <AppCard padding="none">
          <AppStack gap="md">
            <AppCard>
              <AppSearchField
                label={`Buscar ${config.itemLabel}`}
                placeholder="Ticker ou nome"
                value={search}
                onChange={setSearch}
              />
            </AppCard>
            <AppSimpleTable
              rows={visibleAssets}
              columns={columns}
              getRowKey={(asset) => asset.ticker}
              onRowClick={(asset) => {
                if (asset.asset_id != null) navigate(`/market/asset/${asset.asset_id}`)
              }}
              isRowClickable={(asset) => asset.asset_id != null}
              pageSize={10}
              fixedHeight={620}
              emptyMessage={`Nenhum ${config.itemLabel} encontrado.`}
              defaultSort={{ column: 'Volume', direction: 'desc' }}
            />
          </AppStack>
        </AppCard>
      </AppStack>
    </AppStack>
  )
}

function catalogueColumns(config: MarketPageConfig): AppSimpleTableColumn<MarketCatalogueAsset>[] {
  const columns: AppSimpleTableColumn<MarketCatalogueAsset>[] = [
    {
      label: config.kind === 'crypto' ? 'Criptoativo' : config.kind === 'etf' ? 'ETF' : 'Ação',
      sortValue: (asset) => asset.ticker,
      render: (asset) => (
        <AppStack gap="none">
          <AppText variant="bodySmall">{asset.ticker}</AppText>
          <AppText variant="caption" tone="secondary">{asset.name}</AppText>
        </AppStack>
      ),
    },
    {
      label: 'Preço',
      align: 'right',
      sortValue: (asset) => asset.price,
      render: (asset) => money(asset.price, asset.currency),
    },
    {
      label: 'Variação',
      align: 'right',
      sortValue: (asset) => asset.change_percent,
      render: (asset) => change(asset.change_percent),
    },
    {
      label: 'Volume',
      align: 'right',
      sortValue: (asset) => asset.volume,
      render: (asset) => config.volumeAsMoney
        ? compactMoney(asset.volume, asset.currency)
        : integer(asset.volume),
    },
  ]

  if (config.showMarketCap) {
    columns.push({
      label: 'Valor de mercado',
      align: 'right',
      sortValue: (asset) => asset.market_cap,
      render: (asset) => compactMoney(asset.market_cap, asset.currency),
    })
  }

  return columns
}

const money = (value: number | null, currency: string) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'currency',
        currency,
        minimumFractionDigits: value < 1 ? 4 : 2,
        maximumFractionDigits: value < 1 ? 8 : 2,
      })

const compactMoney = (value: number | null, currency: string) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 2,
      })

const integer = (value: number | null) =>
  value == null ? '—' : Math.round(value).toLocaleString('pt-BR')

const change = (value: number | null) => {
  if (value == null) return '—'
  return (
    <AppText
      variant="bodySmall"
      tone={value > 0 ? 'success' : value < 0 ? 'danger' : 'secondary'}
      noWrap
    >
      {value > 0 ? '+' : ''}{value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%
    </AppText>
  )
}
