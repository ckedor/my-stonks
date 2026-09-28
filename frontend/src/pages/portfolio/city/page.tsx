import { lazy, Suspense, useEffect, useMemo } from 'react'

import { assetBuildingId, assetBuildingItems, buildingTypeOf } from '@/components/city-game/asset-buildings'
import { categoryWins, cityBonuses, dividendBonusUsd, receivedDividends } from '@/components/city-game/bonuses'
import { CITY_CATALOG } from '@/components/city-game/catalog'
import {
  assetBuildingShop, assetIdOf, cityBalance, upgradeFor, withPrices, type HoldingForCity,
} from '@/components/city-game/economy'
import { ASSET_LAYOUT_REVISION, displacedAssets } from '@/components/city-game/layout'
import { CITY_MAP, CITY_MAP_SIZE } from '@/components/city-game/map'
import { TERRITORY_STAGES, territoryOf } from '@/components/city-game/territory'
import { CITY_TIERS, cityTierStanding, projectTierArrival } from '@/components/city-game/tiers'
import {
  AppPageHeader, AppSkeleton, AppStack, AppText, isoTerrainAvailability,
  type IsoBuilderItem, type IsoBuilderPlacement, type IsoBuilderStatus,
} from '@/components/ui'
import {
  useBenchmarksIn, useCategoryReturnsIn, useContributionAverageIn, useDividendsIn, usePatrimonyIn,
  usePortfolioReturnsIn, usePositionsIn, useSelectedPortfolio, useSelectedPortfolioId,
} from '@/queries/portfolio'
import { EMPTY_LIST } from '@/queries/empty'
import { cityOf, useCityBuilderStore } from '@/stores/city-builder'
import type { PortfolioPositionEntry } from '@/types'

import DividendBonusDialog from './DividendBonusDialog'
import TerritoryDialog from './TerritoryDialog'

const AppIsoBuilder = lazy(() => import('@/components/ui/AppIsoBuilder'))

const BOARD_HEIGHT = 'max(560px, calc(100dvh - 150px))'
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdShort = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const priceLabel = (price: number) => usdShort.format(price)

function holdingsOf(positions: PortfolioPositionEntry[]): HoldingForCity[] {
  return positions.map(position => ({
    assetId: position.asset_id, ticker: position.ticker, name: position.name,
    assetType: position.type, valueUsd: position.value,
  }))
}

const EMPTY_BENCHMARKS = {}
const CITY_TIER_NAMES = new Map(CITY_TIERS.map(tier => [tier.rank, tier.name]))

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** Mês e ano: a projeção não tem precisão de dia. */
const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`

/** O jogo da cidade, pago com a carteira.
 *
 *  Tudo em dólar. O dinheiro é o patrimônio mais os dividendos recebidos e
 *  os bônus — dividendo em dobro, um quarto de cada aporte, prêmio por
 *  categoria que vence o benchmark no mês —, e o que está construído é o que
 *  foi gasto dele. A patente sobe a cada degrau de patrimônio. Cada ativo da carteira dá
 *  um prédio de graça, do tamanho do que se tem nele — um por ativo —, que
 *  não cresce sozinho: quando o ativo passa a valer mais um andar, o prédio
 *  ganha uma marca no mapa, e o upgrade é um clique nele. */
export default function CityPage() {
  const portfolioId = useSelectedPortfolioId()
  return portfolioId == null
    ? <AppStack gap="lg"><AppPageHeader title="Cidade" /><AppSkeleton height={BOARD_HEIGHT} /></AppStack>
    : <CityGame portfolioId={portfolioId} />
}

function CityGame({ portfolioId }: { portfolioId: number }) {
  const { data: positions = EMPTY_LIST, isLoading: loadingPositions } = usePositionsIn('USD')
  const { data: dividends = EMPTY_LIST, isLoading: loadingDividends } = useDividendsIn('USD')
  const { data: patrimony = EMPTY_LIST, isLoading: loadingPatrimony } = usePatrimonyIn('USD')
  const { data: categoryReturns = EMPTY_LIST, isLoading: loadingCategoryReturns } = useCategoryReturnsIn('USD')
  const { data: benchmarks = EMPTY_BENCHMARKS, isLoading: loadingBenchmarks } = useBenchmarksIn('USD')
  const { data: returns = EMPTY_LIST } = usePortfolioReturnsIn('USD')
  const { data: contributionAverage } = useContributionAverageIn('USD')
  const portfolio = useSelectedPortfolio()
  const store = useCityBuilderStore()
  const city = cityOf(store.cities, portfolioId)

  const catalog = useMemo(() => withPrices(CITY_CATALOG), [])
  const holdings = useMemo(() => holdingsOf(positions), [positions])
  const holdingsById = useMemo(() => new Map(holdings.map(holding => [holding.assetId, holding])), [holdings])

  const items = useMemo<IsoBuilderItem[]>(() => {
    const onBoard = [...city.placements.map(placement => placement.item), ...city.pending]
    const taken = new Set(onBoard.flatMap(item => assetIdOf(item) ?? []))
    const shop = assetBuildingShop(holdings, taken)
    const types = new Map(holdings.map(holding => [holding.assetId, buildingTypeOf(holding.assetType)]))
    const variants = assetBuildingItems([...onBoard, ...shop.map(item => item.id)], types)
    return [...new Map([...variants, ...catalog, ...shop].map(item => [item.id, item])).values()]
  }, [catalog, holdings, city])
  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])

  const today = new Date().toISOString().slice(0, 10)
  const received = useMemo(() => receivedDividends(dividends, today), [dividends, today])
  const dividendsUsd = received.reduce((sum, dividend) => sum + dividend.amount, 0)
  const benchmarkOf = useMemo(
    () => new Map((portfolio?.custom_categories ?? []).flatMap(category =>
      category.benchmark?.short_name ? [[category.id, category.benchmark.short_name] as const] : [])),
    [portfolio],
  )
  const wins = useMemo(
    () => categoryWins(categoryReturns, benchmarks, benchmarkOf, today),
    [categoryReturns, benchmarks, benchmarkOf, today],
  )
  const bonuses = cityBonuses({ dividendsUsd, patrimony, wins })
  const patrimonyUsd = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0)
  const balance = cityBalance({ patrimonyUsd, dividendsUsd, bonusUsd: bonuses.totalUsd }, city.placements, itemsById)
  const tier = cityTierStanding(patrimonyUsd)
  // Por patente, e não por render: o construtor guarda o que mediu de cada
  // área enquanto ela for o mesmo objeto.
  const rank = tier.current.rank
  const territory = useMemo(() => territoryOf(rank), [rank])
  // A primeira área vem com o jogo e não é anunciada.
  const newAreas = territory.opened.slice(Math.max(city.seenTerritory ?? 1, 1))
  // O CAGR mais recente da série, como fração; a projeção espera a série e o
  // aporte chegarem em vez de mostrar uma data que depois pula.
  const cagr = [...returns].reverse().find(entry => entry.cagr != null)?.cagr ?? 0
  const projection = tier.next && contributionAverage
    ? projectTierArrival({
      patrimonyUsd, targetUsd: tier.next.thresholdUsd, annualRate: cagr,
      monthlyContributionUsd: contributionAverage.monthly_average, today,
    })
    : null
  const unseenDividends = useMemo(() => {
    const seen = new Set(city.seenDividends ?? [])
    return received.filter(dividend => !seen.has(dividend.id))
  }, [received, city.seenDividends])
  const marked = useMemo(
    () => new Set(city.placements.filter(placement => upgradeFor(placement.item, holdingsById)).map(placement => placement.id)),
    [city.placements, holdingsById],
  )
  const upgradeOf = (placement: IsoBuilderPlacement) => {
    const next = upgradeFor(placement.item, holdingsById)
    return next ? { item: assetBuildingId(next), label: `Crescer para ${usd.format(next.valueUsd)}` } : null
  }

  const loading = loadingPositions || loadingDividends || loadingPatrimony || loadingCategoryReturns || loadingBenchmarks
  const isLand = useMemo(() => isoTerrainAvailability(CITY_MAP, CITY_MAP_SIZE), [])
  useEffect(() => {
    if (loading || (city.assetLayoutRevision ?? 0) >= ASSET_LAYOUT_REVISION) return
    store.reconcileLayout(portfolioId, ASSET_LAYOUT_REVISION, displacedAssets(city.placements, itemsById, CITY_MAP_SIZE, isLand))
  }, [loading, city, itemsById, isLand, portfolioId, store])
  const status: IsoBuilderStatus = {
    progress: {
      label: `Patente ${tier.current.rank} · pelo patrimônio`,
      title: tier.current.name,
      value: tier.progress,
      lines: [
        `Patrimônio ${usd.format(patrimonyUsd)}`,
        ...(territory.next ? [`Próxima área: ${territory.next.stage.name}, como ${territory.next.tier.name}`] : []),
        ...(tier.next && tier.remainingUsd != null
          ? [
            `Faltam ${usd.format(tier.remainingUsd)} para ${tier.next.name}`,
            projection ? `Previsão: ${monthLabel(projection.targetDate)}` : 'Sem previsão no ritmo atual',
          ]
          : ['O topo da escala']),
      ],
    },
    label: 'Dinheiro para construir',
    value: usd.format(balance.balanceUsd),
    tone: balance.balanceUsd < 0 ? 'danger' : 'default',
    rows: [
      { label: 'Patrimônio', value: usd.format(balance.patrimonyUsd) },
      { label: 'Dividendos recebidos', value: usd.format(balance.dividendsUsd) },
      {
        label: 'Bônus', value: `+${usd.format(bonuses.totalUsd)}`, tone: 'success',
        details: [
          { label: 'Dividendos em dobro', value: `+${usd.format(bonuses.dividendUsd)}` },
          { label: '¼ dos aportes', value: `+${usd.format(bonuses.contributionUsd)}` },
          { label: `Benchmark · ${wins.length} ${wins.length === 1 ? 'mês' : 'meses'}`, value: `+${usd.format(bonuses.benchmarkUsd)}` },
        ],
      },
      {
        label: 'Território', value: `${territory.opened.length} de ${TERRITORY_STAGES.length} áreas`,
        details: TERRITORY_STAGES.map((stage, i) => ({
          label: stage.name,
          value: i < territory.opened.length ? 'Aberta' : CITY_TIER_NAMES.get(stage.fromRank) ?? '—',
          tone: i < territory.opened.length ? 'success' as const : 'default' as const,
        })),
      },
      { label: 'Construído', value: balance.spentUsd ? `−${usd.format(balance.spentUsd)}` : usd.format(0) },
      ...(city.pending.length ? [{ label: 'A colocar', value: `${city.pending.length} peças` }] : []),
      ...(marked.size ? [{ label: 'Podem crescer', value: `${marked.size} ${marked.size === 1 ? 'escultura' : 'esculturas'}`, tone: 'success' as const }] : []),
    ],
    note: balance.balanceUsd < 0
      ? 'O patrimônio caiu abaixo do que está construído: nada novo se compra até o saldo voltar.'
      : city.pending.length ? 'Suas peças aguardam na aba A colocar. Escolha um espaço livre para colocá-las.'
      : marked.size ? 'A marca dourada no mapa aponta quem pode crescer: clique na escultura.' : undefined,
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader title="Cidade" />

      {!loading && unseenDividends.length === 0 && (
        <TerritoryDialog
          areas={newAreas}
          next={territory.next}
          onClose={() => store.markTerritorySeen(portfolioId, territory.opened.length)}
        />
      )}

      {!loading && (
        <DividendBonusDialog
          dividends={unseenDividends}
          bonusUsd={dividendBonusUsd(unseenDividends.reduce((sum, dividend) => sum + dividend.amount, 0))}
          onClose={() => store.markDividendsSeen(portfolioId, unseenDividends.map(dividend => dividend.id))}
        />
      )}

      {loading ? <AppSkeleton height={BOARD_HEIGHT} /> : (
        <Suspense fallback={<AppSkeleton height={BOARD_HEIGHT} />}>
          {holdings.length === 0 && (
            <AppText variant="bodySmall" tone="secondary">
              Esta carteira ainda não tem posições: sem patrimônio, só ruas e árvores são de graça.
            </AppText>
          )}
          <AppIsoBuilder
            items={items}
            placements={city.placements}
            size={CITY_MAP_SIZE}
            height={BOARD_HEIGHT}
            terrain={CITY_MAP}
            boundless
            budget={balance.balanceUsd}
            priceLabel={priceLabel}
            marked={marked}
            status={status}
            buildable={territory.buildable}
            onPlace={pieces => store.place(portfolioId, pieces)}
            onMove={moves => store.move(portfolioId, moves)}
            onRemove={ids => store.remove(portfolioId, ids)}
            onReplace={(id, item) => store.replace(portfolioId, id, item)}
            upgradeOf={upgradeOf}
            onUpgrade={(id, item) => store.upgrade(portfolioId, id, item)}
            pending={city.pending}
            onPlacePending={piece => store.placePending(portfolioId, piece)}
          />
        </Suspense>
      )}
    </AppStack>
  )
}
