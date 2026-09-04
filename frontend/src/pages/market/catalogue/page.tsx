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
  AppTabs,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { ASSET_TYPES } from '@/constants/assetTypes'
import FavoriteAssets from '@/pages/market/ativos/FavoriteAssets'
import MarketBenchmarkCard from '@/pages/market/components/MarketBenchmarkCard'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* Uma praça, e não uma classe de ativo, é o assunto de uma tela de mercado.
 *
 * Ação e ETF da mesma bolsa se leem juntos — o benchmark é o mesmo, a moeda é
 * a mesma, e quem chega quer ver o que está acontecendo ali. Eram quatro
 * telas quase idênticas; viraram duas, e a classe passou a ser uma aba dentro
 * de cada uma. */

/** A aba de uma praça: uma classe de ativo, e o que muda na tabela dela. */
interface MarketTabConfig {
  id: MarketCatalogueKind
  label: string
  assetTypeId: number
  itemLabel: string
  sectionTitle: string
  showMarketCap?: boolean
  volumeAsMoney?: boolean
}

interface MarketPageConfig {
  breadcrumb: string
  description: string
  pageTitle: string
  benchmarkTitle: string
  benchmarks: string[]
  /** `false` na cripto, que não é de bolsa nenhuma. */
  brazilian?: boolean
  tabs: MarketTabConfig[]
}

export type MarketPageId = 'br' | 'us' | 'crypto'

const CONFIG: Record<MarketPageId, MarketPageConfig> = {
  br: {
    breadcrumb: 'Bolsa BR',
    description: 'Cotações do que é negociado na B3 e comparação com os benchmarks da praça.',
    pageTitle: 'Bolsa BR',
    benchmarkTitle: 'IBOVESPA contra CDI',
    benchmarks: ['IBOVESPA', 'CDI'],
    brazilian: true,
    tabs: [
      {
        id: 'stock',
        label: 'Ações',
        assetTypeId: ASSET_TYPES.STOCK,
        itemLabel: 'ação',
        sectionTitle: 'Todas as ações',
        showMarketCap: true,
      },
      {
        id: 'etf',
        label: 'ETFs',
        assetTypeId: ASSET_TYPES.ETF,
        itemLabel: 'ETF',
        sectionTitle: 'Todos os ETFs',
      },
    ],
  },
  us: {
    breadcrumb: 'Bolsa EUA',
    description: 'Cotações do que o cadastro acompanha fora da B3, em dólar.',
    pageTitle: 'Bolsa EUA',
    benchmarkTitle: 'S&P 500 contra CDI',
    benchmarks: ['S&P500', 'CDI'],
    brazilian: false,
    tabs: [
      {
        id: 'stock-us',
        label: 'Ações',
        assetTypeId: ASSET_TYPES.STOCK,
        itemLabel: 'ação',
        sectionTitle: 'Todas as ações',
      },
      {
        id: 'etf-us',
        label: 'ETFs',
        assetTypeId: ASSET_TYPES.ETF,
        itemLabel: 'ETF',
        sectionTitle: 'Todos os ETFs',
      },
    ],
  },
  crypto: {
    breadcrumb: 'Cripto',
    description: 'Cotações de criptoativos em reais e desempenho do Bitcoin contra o CDI.',
    pageTitle: 'Mercado de Criptoativos',
    benchmarkTitle: 'Bitcoin contra CDI',
    benchmarks: ['CDI'],
    tabs: [
      {
        id: 'crypto',
        label: 'Criptoativos',
        assetTypeId: ASSET_TYPES.CRIPTO,
        itemLabel: 'criptoativo',
        sectionTitle: 'Todos os criptoativos',
        volumeAsMoney: true,
      },
    ],
  },
}

export default function MarketCataloguePage({ market }: { market: MarketPageId }) {
  const config = CONFIG[market]
  const navigate = useNavigate()
  const [tabId, setTabId] = useState<MarketCatalogueKind>(config.tabs[0].id)
  const tab = config.tabs.find((item) => item.id === tabId) ?? config.tabs[0]
  const kind = tab.id
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
  const columns = useMemo(() => catalogueColumns(tab), [tab])

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

      {/* O recorte é o tipo de ativo, e não a lista de ids da página: mandar
          o catálogo inteiro na query string dava URLs de dezenas de milhares
          de caracteres a cada render. */}
      <FavoriteAssets limit={8} assetTypeId={tab.assetTypeId} brazilian={config.brazilian} />

      <MarketBenchmarkCard
        title={config.benchmarkTitle}
        benchmarks={config.benchmarks}
        persistKey={`market-${market}-benchmarks`}
        external={kind === 'crypto' ? {
          assetId: bitcoinId,
          key: 'BTC',
          label: 'Bitcoin',
          color: '#f7931a',
        } : undefined}
      />

      <AppStack gap="md">
        {/* Ação e ETF são a mesma praça vista por duas lentes: a aba troca a
            lente, e o benchmark acima dela continua sendo o mesmo. */}
        {config.tabs.length > 1 && (
          <AppTabs
            items={config.tabs.map((item) => ({ id: item.id, label: item.label }))}
            value={tabId}
            onChange={(next) => {
              setTabId(next)
              setSearch('')
            }}
            label="Classe de ativo"
          />
        )}
        <SectionTitle>{tab.sectionTitle} · {visibleAssets.length}</SectionTitle>
        <AppCard padding="none">
          <AppStack gap="md">
            <AppCard>
              <AppSearchField
                label={`Buscar ${tab.itemLabel}`}
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
              emptyMessage={`Nenhum ${tab.itemLabel} encontrado.`}
              defaultSort={{ column: 'Volume', direction: 'desc' }}
            />
          </AppStack>
        </AppCard>
      </AppStack>
    </AppStack>
  )
}

function catalogueColumns(config: MarketTabConfig): AppSimpleTableColumn<MarketCatalogueAsset>[] {
  const columns: AppSimpleTableColumn<MarketCatalogueAsset>[] = [
    {
      label: config.label,
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
