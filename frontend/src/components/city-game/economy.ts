import { isoPieceVolume, type IsoBuilderItem, type IsoBuilderPlacement } from '@/components/ui'

import {
  M3_PER_USD, assetBuildingItem, buildingTypeOf, clampValueUsd,
  assetBuildingShape, normalizeTicker, parseAssetBuildingId, type AssetBuilding,
} from './asset-buildings'

/* A economia da cidade.

   O dinheiro do jogo é o do jogador, em dólar: o patrimônio da carteira mais
   os dividendos que ela já recebeu. O que está construído no mapa é o que
   foi gasto dele, e o saldo é a diferença — se o patrimônio cai depois de
   gasto, o saldo fica negativo, como uma dívida, e nada novo se compra até
   ele voltar.

   Um item custa o volume que tem, na régua dos prédios de ativo com um
   desconto de dez vezes: um prédio da loja do tamanho do prédio de um ativo
   de US$ 10 mil custa US$ 1 mil. Na régua cheia, a loja inteira custava o
   patrimônio de uma carteira grande, e o que entrava num mês — dividendos,
   bônus — não comprava quase nada. Ruas e árvores são de graça, e os
   prédios de ativo também — eles não se compram, vêm do que se tem. Um
   preço fixado no catálogo, pelo estúdio do jogo, vale no lugar do volume.

   Além do patrimônio, entram bônus (`bonuses.ts`): os dividendos contam em
   dobro, cada aporte rende um quarto dele, e cada categoria que vence o
   benchmark num mês fechado rende um prêmio fixo. */

/** Onde ninguém paga: ruas de todo tipo e a árvore comum. */
const FREE_GROUPS = new Set(['Ruas'])
const FREE_ITEMS = new Set(['tree'])
/** O menor preço de um item que não é de graça: chão, praça. */
const MIN_PRICE = 10
/** Quanto do valor em volume a loja cobra. */
const PRICE_SCALE = 0.1

/** Arredonda para dois algarismos: US$ 17.700, não US$ 17.696. */
function roundPrice(value: number) {
  if (value < 100) return Math.max(MIN_PRICE, Math.round(value / 5) * 5)
  const unit = 10 ** (Math.floor(Math.log10(value)) - 1)
  return Math.round(value / unit) * unit
}

export function itemPrice(item: IsoBuilderItem): number {
  if (FREE_GROUPS.has(item.group) || FREE_ITEMS.has(item.id)) return 0
  return roundPrice(isoPieceVolume(item.recipe) / M3_PER_USD * PRICE_SCALE)
}

/** O catálogo com o preço de cada item. Medir o volume desenha a receita,
 *  então é feito uma vez por item, não a cada render. */
export const withPrices = (catalog: IsoBuilderItem[]): IsoBuilderItem[] =>
  catalog.map(item => ({ ...item, price: item.price ?? itemPrice(item) }))

export interface CityBalance {
  patrimonyUsd: number
  dividendsUsd: number
  /** Tudo o que os bônus somam: dividendo em dobro, aporte, benchmark. */
  bonusUsd: number
  spentUsd: number
  /** Patrimônio + dividendos + bônus − gasto. Negativo é dívida. */
  balanceUsd: number
}

export function cityBalance(
  { patrimonyUsd, dividendsUsd, bonusUsd = 0 }: { patrimonyUsd: number; dividendsUsd: number; bonusUsd?: number },
  placements: IsoBuilderPlacement[],
  itemsById: Map<string, IsoBuilderItem>,
): CityBalance {
  const spentUsd = placements.reduce((sum, placement) => sum + (itemsById.get(placement.item)?.price ?? 0), 0)
  return {
    patrimonyUsd, dividendsUsd, bonusUsd, spentUsd,
    balanceUsd: patrimonyUsd + dividendsUsd + bonusUsd - spentUsd,
  }
}

/** O que a cidade precisa de uma posição da carteira. */
export interface HoldingForCity {
  assetId: number
  ticker: string | null
  name: string
  assetType: string
  valueUsd: number
}

/** O prédio que uma posição merece hoje. Sem ticker — um título, um fundo
 *  —, o letreiro leva o começo do nome. */
export function holdingBuilding(holding: HoldingForCity): AssetBuilding {
  return {
    type: buildingTypeOf(holding.assetType),
    ticker: normalizeTicker(holding.ticker ?? holding.name) || `A${holding.assetId}`,
    valueUsd: clampValueUsd(holding.valueUsd),
    assetId: holding.assetId,
  }
}

/** Um prédio construído que já pode crescer: o ativo vale hoje ao menos um
 *  andar a mais do que valia quando o prédio foi posto. Crescer nunca é
 *  automático — isto só aponta, e o jogador decide. */
export function upgradeFor(placedItem: string, holdings: Map<number, HoldingForCity>) {
  const placed = parseAssetBuildingId(placedItem)
  const holding = placed?.assetId == null ? undefined : holdings.get(placed.assetId)
  if (!placed || !holding) return null
  const next = { ...holdingBuilding(holding), material: placed.material }
  if (assetBuildingShape(next).floors <= assetBuildingShape(placed).floors) return null
  return next
}

/** Os prédios de ativo que a loja oferece: um por posição, no tamanho de
 *  hoje, menos os ativos que já estão no mapa ou esperando para voltar. */
export function assetBuildingShop(holdings: HoldingForCity[], taken: Set<number>): IsoBuilderItem[] {
  return holdings
    .filter(holding => holding.valueUsd >= 1 && !taken.has(holding.assetId))
    .map(holding => assetBuildingItem(holdingBuilding(holding)))
}

export const assetIdOf = (item: string) => parseAssetBuildingId(item)?.assetId
