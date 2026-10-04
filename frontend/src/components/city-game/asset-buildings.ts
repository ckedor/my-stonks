import { type AssetSculptureMaterial, type AssetSculptureStyle, type AssetTowerStyle, type IsoBuilderItem } from '@/components/ui'
import { assetSculptureRecipe, assetSculptureLayout, ASSET_SCULPTURE_MATERIALS, assetTowerShape } from '@/components/ui/city'

/* Asset sculptures share a civic stone pedestal. The id preserves the
   holding's value and finish across reloads; old tower ids remain readable. */

export type AssetBuildingType = 'STOCK' | 'ETF' | 'FII' | 'FI' | 'TREASURY' | 'FIXED_INCOME' | 'CRIPTO'

export const ASSET_BUILDING_TYPES: { value: AssetBuildingType; label: string }[] = [
  { value: 'STOCK', label: 'Ação' },
  { value: 'ETF', label: 'ETF' },
  { value: 'FIXED_INCOME', label: 'Renda fixa' },
  { value: 'FII', label: 'FII' },
  { value: 'FI', label: 'Fundos de investimento' },
  { value: 'TREASURY', label: 'Tesouro' },
  { value: 'CRIPTO', label: 'Cripto' },
]

const STYLE: Record<AssetBuildingType, AssetTowerStyle> = {
  STOCK: 'twist', ETF: 'twist', FIXED_INCOME: 'column', FII: 'ribbed', FI: 'twist', TREASURY: 'column', CRIPTO: 'facet',
}

const SCULPTURE: Record<AssetBuildingType, AssetSculptureStyle> = {
  STOCK: 'flame', ETF: 'bull', FII: 'turtle', FI: 'octopus', TREASURY: 'shield', FIXED_INCOME: 'piggy', CRIPTO: 'phoenix',
}

/** A âncora: este patrimônio tem o volume do Burj Khalifa do jogo. */
const ANCHOR = { valueUsd: 100_000, volume: 950_000 }
/** A régua do jogo inteiro: o volume que um dólar compra. */
export const M3_PER_USD = ANCHOR.volume / ANCHOR.valueUsd
/** O maior prédio, que chega ao lote 6×6. */
export const TOP_VALUE_USD = 200_000
export const MIN_VALUE_USD = 1

export interface AssetBuilding {
  type: AssetBuildingType
  ticker: string
  /** Patrimônio no ativo, em dólares inteiros. */
  valueUsd: number
  /** O ativo da carteira que o prédio representa. Ausente no sandbox. */
  assetId?: number
  material?: AssetSculptureMaterial
}

/** Positions expose AssetType.short_name (e.g. Cripto), while sandbox ids
 * use canonical codes. Both select the same sculpture. */
const TYPE_OF_ASSET: Record<string, AssetBuildingType> = {
  STOCK: 'STOCK', BDR: 'STOCK', ETF: 'ETF',
  FII: 'FII', REIT: 'FII',
  TREASURY: 'TREASURY', CDB: 'FIXED_INCOME', DEB: 'FIXED_INCOME', CRI: 'FIXED_INCOME', CRA: 'FIXED_INCOME', LCA: 'FIXED_INCOME', LCI: 'FIXED_INCOME', PREV: 'FIXED_INCOME', FI: 'FI',
  CRIPTO: 'CRIPTO',
  TESOURO: 'TREASURY', 'AÇÃO': 'STOCK', 'PREVIDÊNCIA': 'FIXED_INCOME', 'DEBÊNTURE': 'FIXED_INCOME',
}
export const buildingTypeOf = (assetType: string): AssetBuildingType => TYPE_OF_ASSET[assetType.trim().toUpperCase()] ?? 'STOCK'

export const ASSET_BUILDING_GROUP = 'Ativos'
const PREFIX = 'asset-building'

/** Só letras e números, em caixa alta: o ticker vira parte do id. */
export const normalizeTicker = (ticker: string) => ticker.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)

export const clampValueUsd = (value: number) => Math.min(TOP_VALUE_USD, Math.max(MIN_VALUE_USD, Math.round(value)))

export const assetBuildingId = ({ type, ticker, valueUsd, assetId, material }: AssetBuilding) =>
  `${PREFIX}:${type}:${ticker}:${valueUsd}${assetId == null ? (material ? ':' : '') : `:${assetId}`}${material ? `:${material}` : ''}`

export function parseAssetBuildingId(id: string): AssetBuilding | null {
  const [prefix, type, ticker, value, asset, material, ...rest] = id.split(':')
  const valueUsd = Number(value)
  const assetId = asset == null || asset === '' ? undefined : Number(asset)
  if (prefix !== PREFIX || rest.length || !Object.hasOwn(STYLE, type) || !ticker) return null
  if (!Number.isInteger(valueUsd) || valueUsd < MIN_VALUE_USD || valueUsd > TOP_VALUE_USD) return null
  if (assetId !== undefined && !Number.isInteger(assetId)) return null
  if (material !== undefined && !ASSET_SCULPTURE_MATERIALS.some(option => option.value === material)) return null
  return { type: type as AssetBuildingType, ticker, valueUsd, assetId, ...(material ? { material: material as AssetSculptureMaterial } : {}) }
}

/** Em m³: o patrimônio vezes a mesma proporção para todos. */
export const assetBuildingVolume = (building: AssetBuilding) => building.valueUsd * M3_PER_USD

export function assetBuildingShape(building: AssetBuilding) {
  // Keep the legacy occupied area and growth threshold for saved cities.
  const previous = assetTowerShape(assetBuildingVolume(building), STYLE[building.type])
  const sculpture = assetSculptureLayout(building.valueUsd, SCULPTURE[building.type], building.ticker)
  return { ...previous, lot: sculpture.lot, width: sculpture.width, depth: sculpture.depth }
}

const signValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const labelValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const formatValueUsd = (value: number) => labelValue.format(value)

export function assetBuildingItem(building: AssetBuilding, hidden = false): IsoBuilderItem {
  const material = building.material ?? (building.type === 'CRIPTO' ? 'fire' : 'bronze')
  return {
    id: assetBuildingId(building),
    appearanceKey: `sculpture-22:${assetBuildingId(building)}`,
    label: `${building.ticker} · ${formatValueUsd(building.valueUsd)}`,
    group: ASSET_BUILDING_GROUP,
    subgroup: ASSET_BUILDING_TYPES.find(option => option.value === building.type)!.label,
    // Um prédio por ativo, qualquer que seja o tamanho.
    unique: building.assetId == null ? undefined : `asset:${building.assetId}`,
    price: 0,
    variants: building.type === 'CRIPTO' ? undefined : { label: 'Material da escultura', options: ASSET_SCULPTURE_MATERIALS.map(option => ({
      id: assetBuildingId({ ...building, material: option.value }), label: option.label,
    })), selected: assetBuildingId({ ...building, material: material }) },
    recipe: assetSculptureRecipe({
      valueUsd: building.valueUsd, style: SCULPTURE[building.type], material,
      sign: building.ticker, caption: signValue.format(building.valueUsd),
    }),
    hidden,
  }
}

/** As peças que o mapa precisa desenhar para os ids dados — colocados ou
 *  esperando para ser colocados —, fora da loja. */
export function assetBuildingItems(ids: string[], types?: Map<number, AssetBuildingType>): IsoBuilderItem[] {
  return [...new Set(ids)].flatMap(id => {
    const building = parseAssetBuildingId(id)
    if (!building) return []
    const resolved = { ...building, type: (building.assetId == null ? undefined : types?.get(building.assetId)) ?? building.type }
    return [
      { ...assetBuildingItem(resolved, true), id },
      ...(resolved.type === 'CRIPTO' ? [] : ASSET_SCULPTURE_MATERIALS.map(option => assetBuildingItem({ ...resolved, material: option.value }, true))),
    ]
  })
}
