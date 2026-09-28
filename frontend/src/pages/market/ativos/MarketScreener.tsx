import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FIIMarketFund, MarketCatalogueAsset, MarketCatalogueKind } from '@/api/market'
import {
  AppAssetLogo,
  AppCard,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppStackItem,
  AppSwitch,
  AppTableSkeleton,
  AppTabs,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useFIIMarket, useMarketCatalogues } from '@/queries/market'
import AssetChange from './AssetChange'
import RegistryBrowser from './RegistryBrowser'
import WorldEtfTable from './WorldEtfTable'
import { compactMoney, fractionPercent, money, ratio } from '@/components/market-catalogue/format'
import {
  cleanCatalogues,
  financialVolume,
  fundsByTicker,
  sectorLabel,
} from '@/components/market-catalogue/market-highlights'

/** Uma linha do screener: o papel no catálogo, com o que cada classe soma. */
interface ScreenerRow {
  asset: MarketCatalogueAsset
  /** Ação ou ETF, na aba de fora da B3, que junta os dois. */
  kindLabel: string
  volume: number | null
  /** Setor da ação, segmento do FII: o recorte que o filtro da aba usa. */
  group: string | null
  fund?: FIIMarketFund
}

type ScreenerTab = 'world-etfs' | 'stock' | 'fii' | 'etf' | 'bdr' | 'us' | 'crypto' | 'registry'

interface TabConfig {
  label: string
  kinds: MarketCatalogueKind[]
  /** O nome do recorte da aba, quando ela tem um. */
  groupLabel?: string
  crypto?: boolean
  columns: (keyof typeof COLUMN)[]
}

const KIND_LABEL: Partial<Record<MarketCatalogueKind, string>> = {
  'stock-us': 'Ação',
  'etf-us': 'ETF',
}

/* Cada classe com as colunas que dizem algo dela: P/VP e dividend yield são
   a régua de um FII e não de uma ação; valor de mercado não existe para um
   ETF. Os ETFs mundiais abrem a lista: são a lista curada que o app
   acompanha todo dia; depois vêm as praças, na ordem do menu do mercado. */
const TABS: Record<ScreenerTab, TabConfig> = {
  'world-etfs': { label: 'ETFs mundiais', kinds: [], columns: [] },
  stock: {
    label: 'Ações BR',
    kinds: ['stock'],
    groupLabel: 'Setor',
    columns: ['asset', 'sector', 'price', 'change', 'volume', 'marketCap'],
  },
  fii: {
    label: 'FIIs',
    kinds: ['fii'],
    groupLabel: 'Segmento',
    columns: ['asset', 'segment', 'price', 'change', 'priceToNav', 'dividendYield', 'volume'],
  },
  etf: { label: 'ETFs', kinds: ['etf'], columns: ['asset', 'price', 'change', 'volume'] },
  bdr: {
    label: 'BDRs',
    kinds: ['bdr'],
    groupLabel: 'Setor',
    columns: ['asset', 'sector', 'price', 'change', 'volume'],
  },
  us: {
    label: 'Exterior',
    kinds: ['stock-us', 'etf-us'],
    columns: ['asset', 'kind', 'price', 'change'],
  },
  crypto: {
    label: 'Cripto',
    kinds: ['crypto'],
    crypto: true,
    columns: ['asset', 'price', 'change', 'volume', 'marketCap'],
  },
  registry: { label: 'Todo o cadastro', kinds: [], columns: [] },
}

const TAB_ITEMS = (Object.keys(TABS) as ScreenerTab[]).map((id) => ({ id, label: TABS[id].label }))

const ALL = ''

const COLUMN: Record<string, AppSimpleTableColumn<ScreenerRow>> = {
  asset: {
    label: 'Ativo',
    width: 'wide',
    sortValue: (row) => row.asset.ticker,
    render: (row) => (
      <AppStack direction="row" gap="sm" align="center">
        <AppAssetLogo src={row.asset.logo_url} size={22} reserve />
        <AppStackItem minWidth={0}>
          <AppStack gap="none">
            <AppText variant="bodySmall" weight="strong" noWrap>
              {row.asset.ticker}
            </AppText>
            <AppText variant="caption" tone="secondary" noWrap>
              {row.asset.name}
            </AppText>
          </AppStack>
        </AppStackItem>
      </AppStack>
    ),
  },
  sector: {
    label: 'Setor',
    sortValue: (row) => row.group,
    render: (row) => (
      <AppStack gap="none">
        <AppText variant="bodySmall" noWrap>
          {row.group ?? '—'}
        </AppText>
        {row.asset.subsector && (
          <AppText variant="caption" tone="secondary" noWrap>
            {row.asset.subsector}
          </AppText>
        )}
      </AppStack>
    ),
  },
  segment: {
    label: 'Segmento',
    sortValue: (row) => row.group,
    render: (row) => (
      <AppText variant="bodySmall" noWrap>
        {row.group ?? '—'}
      </AppText>
    ),
  },
  kind: {
    label: 'Tipo',
    sortValue: (row) => row.kindLabel,
    render: (row) => <AppText variant="bodySmall">{row.kindLabel}</AppText>,
  },
  price: {
    label: 'Preço',
    align: 'right',
    sortValue: (row) => row.asset.price,
    render: (row) => money(row.asset.price, row.asset.currency),
  },
  change: {
    label: 'Dia',
    align: 'right',
    sortValue: (row) => row.asset.change_percent,
    render: (row) => <AssetChange value={row.asset.change_percent} />,
  },
  volume: {
    label: 'Volume financeiro',
    hint: 'O valor negociado no dia: preço vezes papéis negociados.',
    align: 'right',
    sortValue: (row) => row.volume,
    render: (row) => compactMoney(row.volume, row.asset.currency),
  },
  marketCap: {
    label: 'Valor de mercado',
    align: 'right',
    sortValue: (row) => row.asset.market_cap,
    render: (row) => compactMoney(row.asset.market_cap, row.asset.currency),
  },
  priceToNav: {
    label: 'P/VP',
    hint: 'Preço da cota dividido pelo valor patrimonial por cota.',
    align: 'right',
    sortValue: (row) => row.fund?.price_to_nav,
    render: (row) => ratio(row.fund?.price_to_nav),
  },
  dividendYield: {
    label: 'DY 12m',
    hint: 'Rendimentos pagos nos últimos 12 meses sobre o preço de hoje.',
    align: 'right',
    sortValue: (row) => row.fund?.dividend_yield_12m,
    render: (row) => fractionPercent(row.fund?.dividend_yield_12m),
  },
}

/** Todos os papéis de uma classe, com busca, o recorte da classe e as
 *  colunas dela. Abre no mais negociado; qualquer coluna reordena. */
export default function MarketScreener() {
  const [tab, setTab] = useState<ScreenerTab>('world-etfs')
  return (
    <AppStack gap="md">
      <AppTabs items={TAB_ITEMS} value={tab} onChange={setTab} label="Classe de ativo" />
      {tab === 'world-etfs' ? (
        <WorldEtfTable />
      ) : tab === 'registry' ? (
        <RegistryBrowser />
      ) : (
        <ScreenerTable key={tab} config={TABS[tab]} />
      )}
    </AppStack>
  )
}

function ScreenerTable({ config }: { config: TabConfig }) {
  const navigate = useNavigate()
  const isFii = config.columns.includes('dividendYield')
  const { catalogues, loading } = useMarketCatalogues(config.kinds)
  const { funds, loading: fundsLoading } = useFIIMarket(isFii)
  const fiiTickers = useMemo(() => new Set(funds.map((fund) => fund.ticker)), [funds])
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState(ALL)
  const [unpriced, setUnpriced] = useState(false)

  const market = useMemo(() => cleanCatalogues(catalogues, fiiTickers), [catalogues, fiiTickers])
  const rows = useMemo(() => {
    const fundOf = fundsByTicker(funds)
    return config.kinds.flatMap((kind) =>
      (market.get(kind) ?? []).map((asset): ScreenerRow => {
        const fund = isFii ? fundOf.get(asset.ticker) : undefined
        return {
          asset,
          kindLabel: KIND_LABEL[kind] ?? '',
          volume: financialVolume(asset, config.crypto),
          group: isFii
            ? (fund?.segment ?? null)
            : asset.sector == null
              ? null
              : sectorLabel(asset.sector),
          fund,
        }
      })
    )
  }, [market, config, funds, isFii])

  const groups = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.group ?? []))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [rows]
  )
  const hasUnpriced = rows.some((row) => row.asset.price == null)

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return rows.filter(
      (row) =>
        (unpriced || row.asset.price != null) &&
        (group === ALL || row.group === group) &&
        (!query ||
          row.asset.ticker.toLocaleLowerCase('pt-BR').includes(query) ||
          row.asset.name.toLocaleLowerCase('pt-BR').includes(query))
    )
  }, [rows, search, group, unpriced])

  const columns = useMemo(() => config.columns.map((key) => COLUMN[key]), [config])

  if (loading || fundsLoading) return <AppTableSkeleton columns={config.columns.length} rows={12} />

  return (
    <AppCard padding="none">
      <AppStack gap="none">
        <AppCard>
          <AppStack direction="row" gap="sm" align="center" wrap>
            <AppStackItem minWidth={240}>
              <AppSearchField
                label="Buscar"
                hideLabel
                icon
                placeholder="Ticker ou nome"
                value={search}
                onChange={setSearch}
              />
            </AppStackItem>
            {config.groupLabel && groups.length > 0 && (
              <AppSelect
                label={config.groupLabel}
                value={group}
                options={[
                  { value: ALL, label: 'Todos' },
                  ...groups.map((value) => ({ value, label: value })),
                ]}
                onChange={setGroup}
              />
            )}
            {hasUnpriced && (
              <AppSwitch label="Mostrar sem cotação" checked={unpriced} onChange={setUnpriced} />
            )}
            <AppText variant="caption" tone="secondary">
              {visible.length.toLocaleString('pt-BR')} ativos
            </AppText>
          </AppStack>
        </AppCard>
        <AppSimpleTable
          rows={visible}
          columns={columns}
          getRowKey={(row) => `${row.kindLabel}:${row.asset.ticker}`}
          onRowClick={(row) => navigate(`/market/asset/${row.asset.asset_id}`)}
          isRowClickable={(row) => row.asset.asset_id != null}
          pageSize={15}
          emptyMessage="Nenhum ativo encontrado."
          defaultSort={{
            column: config.columns.includes('volume') ? 'Volume financeiro' : 'Ativo',
            direction: config.columns.includes('volume') ? 'desc' : 'asc',
          }}
        />
      </AppStack>
    </AppCard>
  )
}
