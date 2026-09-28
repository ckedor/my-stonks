import { lazy, Suspense, useEffect, useMemo } from 'react'

import { assetBuildingId, assetBuildingItems, buildingTypeOf } from '@/components/city-game/asset-buildings'
import { CITY_CATALOG } from '@/components/city-game/catalog'
import {
  assetBuildingShop, assetIdOf, cityBalance, upgradeFor, withPrices, type HoldingForCity,
} from '@/components/city-game/economy'
import { ASSET_LAYOUT_REVISION, displacedAssets } from '@/components/city-game/layout'
import { CITY_MAP, CITY_MAP_SIZE } from '@/components/city-game/map'
import {
  AppPageHeader, AppSkeleton, AppStack, AppText, isoTerrainAvailability,
  type IsoBuilderItem, type IsoBuilderPlacement, type IsoBuilderStatus,
} from '@/components/ui'
import { useDividendsIn, usePositionsIn, useSelectedPortfolioId } from '@/queries/portfolio'
import { EMPTY_LIST } from '@/queries/empty'
import { cityOf, useCityBuilderStore } from '@/stores/city-builder'
import type { Dividend, PortfolioPositionEntry } from '@/types'

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

/** Só o que já caiu na conta: um provento anunciado ainda não é dinheiro. */
function receivedUsd(dividends: Dividend[]) {
  const today = new Date().toISOString().slice(0, 10)
  return dividends.reduce((sum, dividend) => sum + (dividend.date <= today ? dividend.amount : 0), 0)
}

/** O jogo da cidade, pago com a carteira.
 *
 *  Tudo em dólar. O dinheiro é o patrimônio mais os dividendos recebidos, e
 *  o que está construído é o que foi gasto dele. Cada ativo da carteira dá
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

  const balance = cityBalance(
    { patrimonyUsd: holdings.reduce((sum, holding) => sum + holding.valueUsd, 0), dividendsUsd: receivedUsd(dividends) },
    city.placements, itemsById,
  )
  const marked = useMemo(
    () => new Set(city.placements.filter(placement => upgradeFor(placement.item, holdingsById)).map(placement => placement.id)),
    [city.placements, holdingsById],
  )
  const upgradeOf = (placement: IsoBuilderPlacement) => {
    const next = upgradeFor(placement.item, holdingsById)
    return next ? { item: assetBuildingId(next), label: `Crescer para ${usd.format(next.valueUsd)}` } : null
  }

  const loading = loadingPositions || loadingDividends
  const isLand = useMemo(() => isoTerrainAvailability(CITY_MAP, CITY_MAP_SIZE), [])
  useEffect(() => {
    if (loading || (city.assetLayoutRevision ?? 0) >= ASSET_LAYOUT_REVISION) return
    store.reconcileLayout(portfolioId, ASSET_LAYOUT_REVISION, displacedAssets(city.placements, itemsById, CITY_MAP_SIZE, isLand))
  }, [loading, city, itemsById, isLand, portfolioId, store])
  const status: IsoBuilderStatus = {
    label: 'Saldo',
    value: usd.format(balance.balanceUsd),
    tone: balance.balanceUsd < 0 ? 'danger' : 'default',
    rows: [
      { label: 'Patrimônio', value: usd.format(balance.patrimonyUsd) },
      { label: 'Dividendos recebidos', value: usd.format(balance.dividendsUsd) },
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
