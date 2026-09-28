import { useMemo } from 'react'
import type { MarketCatalogueKind } from '@/api/market'
import { AppPageHeader, AppStack, AppText, SectionLabel, SectionTitle } from '@/components/ui'
import {
  cleanCatalogues,
  etfAsMarketRow,
  financialVolume,
  fundsByTicker,
  largestBy,
  mostTraded,
  onePerCompany,
  sectorLabel,
} from '@/components/market-catalogue/market-highlights'
import { compactMoney, money, signedFraction } from '@/components/market-catalogue/format'
import { useFIIMarket, useMarketCatalogues, useReferenceEtfReadings } from '@/queries/market'
import AssetsSkeleton from './AssetsSkeleton'
import CategoryLeaders, { type LeaderList } from './CategoryLeaders'
import MarketScreener from './MarketScreener'
import RecentAssets from './RecentAssets'

/** As classes da B3 e a cripto: o que a tela lê de cara. As de fora da B3
 *  são o cadastro inteiro e quase sem preço, e só chegam quando alguém abre
 *  a aba delas no screener. */
const HIGHLIGHT_KINDS: MarketCatalogueKind[] = ['stock', 'fii', 'etf', 'bdr', 'crypto']

const LEADERS = 5

const thousands = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
    : value.toLocaleString('pt-BR')

/** Ativos: o que você mais abre primeiro, depois os principais de cada
 *  categoria, e o mercado inteiro para procurar no screener, uma aba por
 *  classe. A carteira não entra: ela tem a sua parte do app. */
export default function MarketAtivosPage() {
  const { catalogues, loading } = useMarketCatalogues(HIGHLIGHT_KINDS)
  const { funds, loading: fundsLoading } = useFIIMarket()
  const { etfs, loading: etfsLoading } = useReferenceEtfReadings()
  const market = useMemo(
    () => cleanCatalogues(catalogues, new Set(funds.map((fund) => fund.ticker))),
    [catalogues, funds]
  )
  /* Tudo o que tem preço de hoje, para os acessados: a bolsa, a cripto e os
     ETFs de fora que o app acompanha. */
  const everything = useMemo(
    () => [
      ...HIGHLIGHT_KINDS.flatMap((kind) => market.get(kind) ?? []),
      ...etfs.map(etfAsMarketRow),
    ],
    [market, etfs]
  )

  const leaders = useMemo<LeaderList[]>(() => {
    const assetsOf = (kind: MarketCatalogueKind) => market.get(kind) ?? []
    const fundOf = fundsByTicker(funds)
    const investors = (ticker: string) => fundOf.get(ticker)?.investors
    return [
      {
        label: 'ETFS MUNDIAIS',
        caption: 'Maior crescimento anual nos últimos 10 anos, com dividendos, em dólar',
        rows: largestBy(etfs, (etf) => etf.reading.ten_year_annualized_return, LEADERS).map(
          (etf) => ({
            asset: etfAsMarketRow(etf),
            metric: `${signedFraction(etf.reading.ten_year_annualized_return)} a.a.`,
            detail: 'em 10 anos',
          })
        ),
      },
      {
        label: 'AÇÕES DO BRASIL',
        caption: 'Maior valor de mercado, uma linha por empresa',
        rows: largestBy(onePerCompany(assetsOf('stock')), (asset) => asset.market_cap, LEADERS).map(
          (asset) => ({
            asset,
            metric: compactMoney(asset.market_cap),
            detail: sectorLabel(asset.sector),
          })
        ),
      },
      {
        label: 'AÇÕES DO BRASIL MAIS NEGOCIADAS',
        caption: 'Maior valor negociado hoje na B3, só ações',
        rows: mostTraded(assetsOf('stock'), { count: LEADERS }).map((asset) => ({
          asset,
          metric: compactMoney(financialVolume(asset)),
          detail: 'negociados hoje',
        })),
      },
      {
        label: 'FIIS',
        caption: 'Mais cotistas',
        rows: largestBy(assetsOf('fii'), (asset) => investors(asset.ticker), LEADERS).map(
          (asset) => ({
            asset,
            metric: `${thousands(investors(asset.ticker)!)} cotistas`,
            detail: fundOf.get(asset.ticker)?.segment ?? undefined,
          })
        ),
      },
      {
        label: 'ETFS DA B3',
        caption: 'Maior valor negociado hoje',
        rows: mostTraded(assetsOf('etf'), { count: LEADERS }).map((asset) => ({
          asset,
          metric: compactMoney(financialVolume(asset)),
          detail: money(asset.price, asset.currency),
        })),
      },
      {
        label: 'CRIPTO',
        caption: 'Maior valor negociado nas últimas 24 horas',
        rows: mostTraded(assetsOf('crypto'), { crypto: true, count: LEADERS }).map((asset) => ({
          asset,
          metric: compactMoney(financialVolume(asset, true)),
          detail: money(asset.price, asset.currency),
        })),
      },
    ]
  }, [market, funds, etfs])

  if (loading || fundsLoading || etfsLoading) return <AssetsSkeleton />

  return (
    <AppStack gap="xl">
      <AppPageHeader
        title="Ativos"
        breadcrumbs={[{ label: 'Mercado', href: '/market/overview' }, { label: 'Ativos' }]}
        description="Os ativos que você mais abre, os principais de cada categoria e todos os papéis para explorar."
      />

      <RecentAssets market={everything} />

      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>OS PRINCIPAIS</SectionLabel>
          <SectionTitle>Os maiores de cada categoria</SectionTitle>
          <AppText variant="caption" tone="secondary">
            Cada categoria no critério que faz sentido para ela; o card diz qual.
          </AppText>
        </AppStack>
        <CategoryLeaders lists={leaders} />
      </AppStack>

      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>EXPLORAR</SectionLabel>
          <SectionTitle>Todos os ativos, por classe</SectionTitle>
          <AppText variant="caption" tone="secondary">
            Qualquer coluna reordena.
          </AppText>
        </AppStack>
        <MarketScreener />
      </AppStack>
    </AppStack>
  )
}
